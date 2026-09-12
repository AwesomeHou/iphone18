import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { FLAT, MM, fromBackLeft, fromTop } from './dimensions'
import { roundedRectShape } from './geometry'

/* ==================================================================
   Real recesses.

   Every detail on this phone was a decal sitting on a convex slab, which
   is most of why it read as a display dummy. A machined port, ten
   speaker holes, a lens sunk into a barrel and a flash pocket are what
   say "assembled object" rather than "moulding".

   Carved once at startup. All the cutters are disjoint, so they merge
   into a single brush and the boolean runs in one pass.

   three-bvh-csg is pinned to 0.0.17: 0.0.18 requires three >= 0.179 and
   this project is on 0.171.
   ================================================================== */

/**
 * Tolerances for deciding whether a triangle belongs to a recess.
 *
 * Both are load-bearing and the obvious sign for each is wrong.
 *
 * GROW is applied OUTWARD. A recess wall lies exactly on the cutter's
 * surface, so a test that shrinks the volume (the natural reading of
 * "inside") excludes the very faces being looked for. A 0.1 mm shrink on
 * a 0.76 mm speaker bore drops the whole wall out of the cavity zone and
 * the grille renders as bright pips.
 *
 * RIM is applied INWARD at the opening. Triangles caught within it stay
 * on the outer surface material, which leaves a lit break around the lip
 * instead of a hard black edge.
 */
const GROW = 0.06
const RIM = 0.2

/** How deep each pocket bites. */
const PORT_DEPTH = 5.5
const HOLE_DEPTH = 3.2
const LENS_DEPTH = 0.55
const FLASH_DEPTH = 0.4

const LENS_POCKET_R = MM.lensRadius + 0.55
const FLASH_POCKET_R = MM.flashRadius + 0.5

interface Recess {
  geometry: THREE.BufferGeometry
  contains: (x: number, y: number, z: number) => boolean
}

/** A bore running along Y: the speaker holes, drilled up into the body. */
function boreY(
  cx: number,
  cz: number,
  r: number,
  openingY: number,
  deepY: number,
  floorY: number
): Recess {
  const geo = new THREE.CylinderGeometry(r, r, Math.abs(floorY - deepY), 20, 1, false)
  geo.translate(cx, (deepY + floorY) / 2, cz)
  const rr = (r + GROW) ** 2
  return {
    geometry: geo,
    contains: (x, y, z) =>
      (x - cx) ** 2 + (z - cz) ** 2 <= rr && y > openingY + RIM && y < floorY + GROW,
  }
}

/** A pocket running along Z: the lens barrel and the flash. */
function boreZ(
  cx: number,
  cy: number,
  r: number,
  openingZ: number,
  deepZ: number,
  floorZ: number
): Recess {
  const geo = new THREE.CylinderGeometry(r, r, Math.abs(floorZ - deepZ), 40, 1, false)
  geo.rotateX(Math.PI / 2)
  geo.translate(cx, cy, (deepZ + floorZ) / 2)
  const rr = (r + GROW) ** 2
  return {
    geometry: geo,
    contains: (x, y, z) =>
      (x - cx) ** 2 + (y - cy) ** 2 <= rr && z < openingZ - RIM && z > floorZ - GROW,
  }
}

/**
 * The USB-C socket.
 *
 * The cutter is the connector's cross-section, a slot with rounded ends,
 * EXTRUDED up into the body. A CapsuleGeometry is the tempting shortcut
 * and is wrong: its axis is the extrusion direction and its cross-section
 * is a circle, so it cuts a round bore that never reaches the surface and
 * leaves a skin over the port.
 */
function portRecess(): Recess {
  const w = MM.portWidth
  const h = MM.portHeight
  const bottomY = -MM.height / 2 - 1
  const topY = -MM.height / 2 + PORT_DEPTH

  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, h / 2), {
    depth: topY - bottomY,
    bevelEnabled: false,
    curveSegments: 24,
  })
  // Extrude runs along +Z with the profile in XY. Stand it up: the
  // profile swings into XZ and the extrusion becomes the drilling axis.
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, bottomY, 0)

  return {
    geometry: geo,
    // A box test is close enough for tagging faces. The inset is what
    // keeps the opening's rim, and the flat bottom edge immediately
    // around it, out of the cavity zone.
    contains: (x, y, z) =>
      Math.abs(x) <= w / 2 + GROW &&
      Math.abs(z) <= h / 2 + GROW &&
      y > -MM.height / 2 + RIM &&
      y < topY + GROW,
  }
}

function buildRecesses(): Recess[] {
  const out: Recess[] = [portRecess()]

  const bottom = -MM.height / 2
  for (let i = 0; i < MM.speakerHoles; i++) {
    const x = MM.speakerFirst + i * MM.speakerPitch
    for (const sign of [-1, 1]) {
      out.push(
        boreY(sign * x, 0, MM.speakerHoleRadius, bottom, bottom - 1.5, bottom + HOLE_DEPTH)
      )
    }
  }

  out.push(
    boreZ(
      fromBackLeft(MM.lensFromLeft),
      fromTop(MM.rearFromTop),
      LENS_POCKET_R,
      FLAT.backZ,
      FLAT.backZ + 1.5,
      FLAT.backZ - LENS_DEPTH
    )
  )
  out.push(
    boreZ(
      fromBackLeft(MM.flashFromLeft),
      fromTop(MM.rearFromTop),
      FLASH_POCKET_R,
      FLAT.backZ,
      FLAT.backZ + 1.5,
      FLAT.backZ - FLASH_DEPTH
    )
  )

  return out
}

export interface CarvedBody {
  geometry: THREE.BufferGeometry
  /** True when the point is inside a recess, used to tag cavity faces. */
  isCavity: (x: number, y: number, z: number) => boolean
  /** Pockets the antenna cap must be punched for, in world mm. */
  capPockets: { x: number; y: number; r: number }[]
}

export function carveBody(body: THREE.BufferGeometry): CarvedBody {
  const recesses = buildRecesses()

  // ExtrudeGeometry comes out non-indexed and CylinderGeometry indexed, so
  // normalise before merging or mergeGeometries refuses the batch.
  const cutterGeo = mergeGeometries(
    recesses.map((r) => (r.geometry.index ? r.geometry.toNonIndexed() : r.geometry)),
    false
  )

  const baseMat = new THREE.MeshBasicMaterial()
  const cutterMat = new THREE.MeshBasicMaterial()
  const base = new Brush(body, baseMat)
  const cutter = new Brush(cutterGeo, cutterMat)
  base.updateMatrixWorld()
  cutter.updateMatrixWorld()

  const evaluator = new Evaluator()
  evaluator.useGroups = false
  evaluator.attributes = ['position', 'normal']

  const result = evaluator.evaluate(base, cutter, SUBTRACTION)
  const geometry = result.geometry.index ? result.geometry.toNonIndexed() : result.geometry
  geometry.computeBoundingBox()

  const isCavity = (x: number, y: number, z: number) => recesses.some((r) => r.contains(x, y, z))

  // The cap is a separate sheet on the back and would roof over the two
  // pockets, so it needs matching holes. Reported in world millimetres;
  // the cap mesh is translated, so it offsets them itself.
  const capPockets = [
    { x: fromBackLeft(MM.lensFromLeft), y: fromTop(MM.rearFromTop), r: LENS_POCKET_R },
    { x: fromBackLeft(MM.flashFromLeft), y: fromTop(MM.rearFromTop), r: FLASH_POCKET_R },
  ]

  for (const r of recesses) r.geometry.dispose()
  cutterGeo.dispose()
  baseMat.dispose()
  cutterMat.dispose()

  return { geometry, isCavity, capPockets }
}
