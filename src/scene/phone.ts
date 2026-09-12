import * as THREE from 'three'
import { ANCHORS, FLAT, MM, SCREEN, fromBackLeft, fromTop } from './dimensions'
import {
  bottomFacingCircle,
  bottomFacingRoundedRect,
  createBodyGeometry,
  roundedPlaneGeometry,
  roundedRectShape,
} from './geometry'
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
  flash: 0.45,
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
  const body = new THREE.Mesh(
    track(createBodyGeometry(MM.width, MM.height, MM.depth, MM.cornerRadius, MM.bevel, 7)),
    materials.aluminum
  )
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

  /* --- back: antenna cap ------------------------------------------ */
  const capHeight = FLAT.height / 2 - fromTop(MM.capFromTop)
  const capGeo = track(
    new THREE.ShapeGeometry(capShape(FLAT.width, capHeight, FLAT.radius), 24)
  )
  capGeo.translate(0, fromTop(MM.capFromTop), 0)
  const cap = backFacing(capGeo, 0, 0, BACK.cap)
  cap.material = materials.antenna
  group.add(cap)

  /* --- back: camera, flash, logo ---------------------------------- */
  const lens = backFacing(
    // 64 segments: at 32 the environment reflection facets into visible
    // radial spokes in the macro shot.
    track(new THREE.CircleGeometry(MM.lensRadius, 64)),
    fromBackLeft(MM.lensFromLeft),
    fromTop(MM.rearFromTop),
    BACK.lens
  )
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
    materials.aluminum
  )
  button.position.set(MM.width / 2 + MM.buttonProtrusion - 1, fromTop(MM.buttonFromTop), 0)
  group.add(button)

  /* --- bottom edge ------------------------------------------------
     y is the phone's OUTER envelope, not the flat-face height. The
     extrusion is widest at mid-thickness, so the bottom of the body sits
     at -height/2 there: placing the port at -FLAT.height/2 buries it
     inside the body and it renders as nothing at all. Over the 3 mm the
     port spans in z the surface is flat to within a tenth of a
     millimetre, so a flat cutout is honest here. */
  const bottomY = -MM.height / 2 - MM.portSurfaceOffset

  const port = new THREE.Mesh(
    track(bottomFacingRoundedRect(MM.portWidth, MM.portHeight, MM.portHeight / 2)),
    materials.slot
  )
  port.position.set(0, bottomY, 0)
  group.add(port)

  const holeGeo = track(bottomFacingCircle(MM.speakerHoleRadius, 16))
  for (let i = 0; i < MM.speakerHoles; i++) {
    const x = MM.speakerFirst + i * MM.speakerPitch
    for (const sign of [-1, 1]) {
      const hole = new THREE.Mesh(holeGeo, materials.slot)
      hole.position.set(sign * x, bottomY, 0)
      group.add(hole)
    }
  }

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
