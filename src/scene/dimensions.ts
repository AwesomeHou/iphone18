/* ==================================================================
   Physical constants for the iPhone 18.

   Every number is millimetres and comes off the concept sheet in
   docs/iphone18.png. One scene unit is one millimetre, so geometry,
   camera framing and the on-page dimension callouts all speak the same
   language and nothing needs converting.

   The body is an ExtrudeGeometry of a rounded-rect plan. Verified
   empirically (see the note on `bevel`): with a POSITIVE bevelSize the
   flat faces come out inset and the mid-thickness is the widest point,
   which is the real iPhone cross-section. A negative bevelSize inverts
   it into a bread loaf.
   ================================================================== */

/** Outer envelope, straight off the concept sheet. */
export const MM = {
  width: 72,
  height: 432,
  depth: 7.8,

  /** Plan-view corner radius of the widest point, off the front view. */
  cornerRadius: 10,

  /** Edge break: the radiused band between the flat face and the side. */
  bevel: 3.2,

  /** Front glass insets, measured from the edge of the FLAT face, which
      is what the eye actually reads as the bezel. */
  bezelSide: 2.8,
  bezelTop: 7,
  bezelBottom: 6,

  /** Earpiece and front camera live in the strip above the glass. */
  earpieceWidth: 11,
  earpieceHeight: 1,
  earpieceY: 210.2,
  frontCameraRadius: 0.85,
  frontCameraY: 207.5,

  /** Rear camera, single lens, upper left as seen from behind. Because the
      back viewer's right is world -X, "upper left in the back view" is +X. */
  lensRadius: 3.4,
  lensX: 22,
  lensY: 190,
  flashRadius: 1.5,
  flashX: 12.5,
  flashY: 190,

  /** Antenna bands. Kept inboard of the bevel so they stay on the flat. */
  antennaY: 198,
  antennaThickness: 1.6,

  /** Right-side button. */
  buttonLength: 30,
  buttonThickness: 1.4,
  buttonProtrusion: 0.9,
  buttonY: 140,

  /** Bottom edge. */
  portWidth: 8.5,
  portHeight: 2.5,
  portInset: 0.06,
  speakerHoleRadius: 0.62,
  speakerHoles: 5,
  speakerPitch: 2.5,
  speakerInset: 11,

  /** Etched logo on the back. */
  logoWidth: 17,
  logoY: 22,
} as const

/** Flat-front-face envelope, derived so it can never drift from MM. */
export const FLAT = {
  width: MM.width - MM.bevel * 2,
  height: MM.height - MM.bevel * 2,
  radius: MM.cornerRadius - MM.bevel,
  /** z of the front face and the back face. */
  frontZ: MM.depth / 2,
  backZ: -MM.depth / 2,
} as const

/** Front glass, derived from the flat face. */
export const SCREEN = {
  width: FLAT.width - MM.bezelSide * 2,
  height: FLAT.height - MM.bezelTop - MM.bezelBottom,
  radius: 5,
  centerY: (MM.bezelTop - MM.bezelBottom) / -2,
  z: FLAT.frontZ + 0.02,
} as const

/** World-space points the 2D dimension callouts project from. */
export const ANCHORS = {
  topCorner: [0, MM.height / 2, 0],
  bottomCorner: [0, -MM.height / 2, 0],
  rightEdge: [MM.width / 2, 0, 0],
  leftEdge: [-MM.width / 2, 0, 0],
  frontFace: [0, 0, FLAT.frontZ],
  bottomEdge: [0, -MM.height / 2, 0],
} as const satisfies Record<string, readonly [number, number, number]>
