import * as THREE from 'three'
import { ANCHORS, COVER, FLAT, MM, SCREEN, fromBackLeft, fromTop } from './dimensions'
import {
  applyBodyZones,
  createBodyGeometry,
  roundedPlaneGeometry,
  roundedRectShape,
} from './geometry'
import { carveBody } from './recess'
import type { PhoneMaterials } from './materials'
import { createMaterials } from './materials'

export interface Phone {
  group: THREE.Group
  materials: PhoneMaterials
  /** Screen mesh, so the camera rig can find it if it ever needs to. */
  screen: THREE.Mesh
  dispose(): void
}

/**
 * Shape of the antenna cap on the back: a band with the two TOP corners
 * rounded to match the body and the bottom edge straight. A plain
 * rectangle would poke out of the silhouette at the corners.
 */
function capShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2
  const r = Math.min(radius, width / 2, height)
  const s = new THREE.Shape()
  s.moveTo(-w, 0)
  s.lineTo(-w, height - r)
  s.absarc(-w + r, height - r, r, Math.PI, Math.PI / 2, true)
  s.lineTo(w - r, height)
  s.absarc(w - r, height - r, r, Math.PI / 2, 0, true)
  s.lineTo(w, 0)
  s.closePath()
  return s
}

/**
 * Layering off the flat faces.
 *
 * These cannot all share one offset, and they cannot be hairline thin
 * either. The spacing has to clear the depth buffer's own precision at
 * the FARTHEST camera key, not the nearest: the specs fold puts the
 * camera 2.3 m away, where a 0.02 mm separation is below one depth step
 * and the screen disappears behind the body entirely. The lens macro
 * gets the same offsets from 52 mm, where 0.45 mm of relief is about one
 * pixel, so one set of numbers serves both ends.
 */
const FRONT = {
  screen: 0.12,
  earpiece: 0.24,
  camera: 0.36,
} as const

const BACK = {
  cap: 0.1,
  logo: 0.3,
  lens: 0.45,
  ring: 0.55,
  flash: 0.25,
} as const

function frontFacing(geo: THREE.BufferGeometry, x: number, y: number, depth: number): THREE.Mesh {
  const m = new THREE.Mesh(geo)
  m.position.set(x, y, FLAT.frontZ + depth)
  return m
}

function backFacing(geo: THREE.BufferGeometry, x: number, y: number, depth: number): THREE.Mesh {
  const m = new THREE.Mesh(geo)
  m.position.set(x, y, FLAT.backZ - depth)
  // 180 deg about Y both turns the face toward the back viewer and
  // un-mirrors the texture, which matters for the logo.
  m.rotation.y = Math.PI
  return m
}

export function createPhone(textures: {
  screen: THREE.Texture | null
  logo: THREE.Texture | null
}): Phone {
  const materials = createMaterials(textures)
  const group = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []

  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g)
    return g
  }

  /* --- body ------------------------------------------------------- */
  // Four zones, in ZONE order: front face, back face, band, chamfer.
  // One roughness for all of it is what made the phone read as a single
  // moulded shell.
  const rawBody = createBodyGeometry(
    MM.width,
    MM.height,
    MM.depth,
    MM.cornerRadius,
    MM.bevel,
    14
  )
  // Carve the port, the ten speaker bores and the two camera pockets, then
  // classify the result. Zoning has to follow the boolean: the recess
  // walls only exist afterwards.
  const carved = carveBody(rawBody)
  rawBody.dispose()
  const bodyGeo = track(carved.geometry)
  applyBodyZones(bodyGeo, MM.depth / 2, MM.depth / 2 - MM.bevel, carved.isCavity)

  const body = new THREE.Mesh(bodyGeo, [
    materials.bodyFront,
    materials.bodyBack,
    materials.bodyBand,
    materials.bodyChamfer,
    materials.cavity,
  ])
  group.add(body)

  /* --- front ------------------------------------------------------ */
  const screen = frontFacing(
    track(roundedPlaneGeometry(SCREEN.width, SCREEN.height, SCREEN.radius)),
    0,
    SCREEN.centerY,
    FRONT.screen
  )
  screen.material = materials.screen
  group.add(screen)

  const earpiece = frontFacing(
    track(roundedPlaneGeometry(MM.earpieceWidth, MM.earpieceHeight, MM.earpieceHeight / 2, 12)),
    0,
    fromTop(MM.earpieceFromTop),
    FRONT.earpiece
  )
  earpiece.material = materials.slot
  group.add(earpiece)

  const frontCam = frontFacing(
    track(new THREE.CircleGeometry(MM.frontCameraRadius, 28)),
    0,
    fromTop(MM.frontCameraFromTop),
    FRONT.camera
  )
  frontCam.material = materials.frontCamera
  group.add(frontCam)

  /* --- cover glass ------------------------------------------------
     One specular sheet over the whole front face. Additive, so it lays
     its reflection over the bezel and the display instead of diluting
     them, and it is what makes the front read as a single piece of
     glass rather than a panel printed into a frame. */
  const cover = new THREE.Mesh(
    track(roundedPlaneGeometry(COVER.width, COVER.height, COVER.radius)),
    materials.coverGlass
  )
  cover.position.set(0, SCREEN.centerY, COVER.z)
  cover.renderOrder = 5
  group.add(cover)

  /* --- back: antenna cap ------------------------------------------ */
  const capHeight = FLAT.height / 2 - fromTop(MM.capFromTop)
  const capBaseY = fromTop(MM.capFromTop)
  const cap = capShape(FLAT.width, capHeight, FLAT.radius)
  // Punch the camera pockets out of the cap, in the cap's own frame.
  for (const p of carved.capPockets) {
    const hole = new THREE.Path()
    hole.absarc(p.x, p.y - capBaseY, p.r, 0, Math.PI * 2, true)
    cap.holes.push(hole)
  }
  const capGeo = track(new THREE.ShapeGeometry(cap, 32))
  capGeo.translate(0, capBaseY, 0)
  const capMesh = backFacing(capGeo, 0, 0, BACK.cap)
  capMesh.material = materials.antenna
  group.add(capMesh)

  /* --- back: camera, flash, logo ---------------------------------- */
  // A shallow dome, not a disc. A flat circle in a pocket still reads as
  // a printed dot; the curvature is what gives it a specular highlight
  // that moves as the camera orbits.
  const lensDome = track(
    new THREE.SphereGeometry(MM.lensRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  )
  lensDome.scale(1, 1, 0.42)
  const lens = backFacing(lensDome, fromBackLeft(MM.lensFromLeft), fromTop(MM.rearFromTop), BACK.lens)
  lens.material = materials.lens
  group.add(lens)

  const lensRing = backFacing(
    track(new THREE.RingGeometry(MM.lensRadius, MM.lensRadius + 0.45, 64)),
    fromBackLeft(MM.lensFromLeft),
    fromTop(MM.rearFromTop),
    BACK.ring
  )
  lensRing.material = materials.lensRing
  group.add(lensRing)

  const flash = backFacing(
    track(new THREE.CircleGeometry(MM.flashRadius, 48)),
    fromBackLeft(MM.flashFromLeft),
    fromTop(MM.rearFromTop),
    BACK.flash
  )
  flash.material = materials.flash
  group.add(flash)

  if (textures.logo) {
    const logoH = (MM.logoWidth * 1000) / 814
    const logo = backFacing(
      track(new THREE.PlaneGeometry(MM.logoWidth, logoH)),
      0,
      fromTop(MM.logoFromTop),
      BACK.logo
    )
    logo.material = materials.logo
    group.add(logo)
  }

  /* --- right side button ------------------------------------------ */
  const button = new THREE.Mesh(
    track(
      new THREE.BoxGeometry(
        MM.buttonProtrusion + 2,
        MM.buttonLength,
        2.8,
        1,
        1,
        1
      )
    ),
    materials.bodyChamfer
  )
  button.position.set(MM.width / 2 + MM.buttonProtrusion - 1, fromTop(MM.buttonFromTop), 0)
  group.add(button)

  /* --- bottom edge ------------------------------------------------
     No decals here any more. The port and the ten speaker holes are cut
     into the body by the boolean in recess.ts, so the bottom edge is
     geometry rather than a dark shape laid on top of it. */

  // A socket tongue, so the port reads as a connector rather than a dent.
  const tongue = new THREE.Mesh(
    track(new THREE.BoxGeometry(MM.portWidth - 2.2, 3.4, 1.1)),
    materials.slot
  )
  tongue.position.set(0, -MM.height / 2 + 3.6, 0)
  group.add(tongue)

  /* --- orientation ------------------------------------------------
     The group is authored with +Y up and the front facing +Z, matching
     the sheet's front view. */
  group.name = 'iPhone 18'

  const dispose = () => {
    for (const g of geometries) g.dispose()
    for (const mat of Object.values(materials)) mat.dispose()
  }

  void roundedRectShape
  void ANCHORS

  return { group, materials, screen, dispose }
}
