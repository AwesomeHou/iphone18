/* ==================================================================
   Physical constants for the iPhone 18.

   Source of truth: docs/iphone18.png, measured pixel by pixel with
   scratch/ref-measure*.ps1 rather than eyeballed.

   One scene unit is one millimetre, so geometry, camera framing and the
   on-page dimension callouts all speak the same numbers.

   HOW THE MEASUREMENTS WERE APPLIED
   ---------------------------------
   The sheet is internally inconsistent: it prints 432 x 72 x 7.8 mm, but
   the views are drawn at roughly 4.26:1 and 0.029 thickness-to-height,
   which would be 432 x 101 x 12.7 mm. 432 = 6 x 72 is deliberate
   arithmetic and the whole page depends on the 6:1 read, so the printed
   envelope wins.

   Every facial proportion is therefore taken as a FRACTION of the drawn
   phone and re-applied to the printed envelope, which is what makes the
   3D match the sheet's look:

     phone in the sheet   x 710..845 (w 135)   y 88..663 (h 575)
     screen               x 717..838 (w 122)   y 116..636 (h 520)
     front camera dot     cx 777.5  cy  98.5   d 6
     earpiece slot        cx 777.5  cy 107.5   22 x 2
     back camera dot      cx 972.5  cy 104.5   d 8        (frame x 952..1084)
     back flash           cx 992.5  cy 104.5   d 6
     back top cap edge    y 114.5
     logo                 cx 1018.5 cy 161     26 x 33
     side button          y 237..283, 46 tall             (frame x 1167..1184, y 88..665)
     port                 35 x 15, 5+5 holes at 9.6 pitch (panel 3.93 px/mm)
     plan corner radius   ~21
   ================================================================== */

/** Printed envelope, straight off the sheet. */
export const MM = {
  width: 72,
  height: 432,
  depth: 7.8,

  /** Plan-view corner radius. 21/135 of the drawn width. Reads as ~11 mm,
      which is also what a real iPhone's corner comes out at. */
  cornerRadius: 11,

  /** Edge break between the flat face and the side band. The sheet's side
      view shows a rounded, mostly flat edge; 2.5 mm leaves a flat band in
      the middle of the 7.8 mm thickness. */
  bevel: 2.5,

  /** Front glass insets, measured from the OUTER edge. The sheet's bezel is
      a near-constant 4.8% of each dimension, which is why the top bezel is
      visibly taller than the sides. */
  bezelSide: 3.73, // 7/135 of the width
  bezelTop: 21.04, // 28/575 of the height
  bezelBottom: 20.29, // 27/575 of the height
  /** The sheet's display meets the bezel at a right angle. Kept at a
      hairline radius only so the silhouette does not alias into a knife. */
  screenRadius: 2,

  /** Earpiece slot. Note it sits BELOW the camera dot in the sheet. */
  earpieceWidth: 11.7, // 22/135
  earpieceHeight: 1.5, // 2/575
  earpieceFromTop: 14.65, // 19.5/575
  frontCameraRadius: 2.25, // 3/575
  frontCameraFromTop: 7.89, // 10.5/575

  /** Rear camera and flash. "Upper left as seen from behind" is world +X,
      because the back viewer's right is world -X. */
  lensRadius: 2.18, // 4/132
  lensFromLeft: 11.18, // 20.5/132, measured on the back view
  flashRadius: 1.64, // 3/132
  flashFromLeft: 22.09, // 39.5/132
  rearFromTop: 11.62, // 15.5/576

  /** White antenna cap on the back, measured from the top edge. */
  capFromTop: 19.12, // 25.5/576

  /** Etched logo, high on the back rather than centred. */
  logoWidth: 14.18, // 26/132
  logoFromTop: 54.0, // 72/576

  /** Right-side button. 46/578 of the height and long, as drawn. */
  buttonLength: 34.4,
  buttonProtrusion: 0.9,
  buttonFromTop: 128.6,

  /** Bottom edge. */
  portWidth: 8.9,
  portHeight: 3.0,
  portSurfaceOffset: 0.06,
  speakerHoleRadius: 0.76,
  speakerHoles: 5,
  speakerFirst: 10.8,
  speakerPitch: 2.45,
} as const

/** Flat-face envelope, derived so it can never drift from MM. */
export const FLAT = {
  width: MM.width - MM.bevel * 2,
  height: MM.height - MM.bevel * 2,
  radius: MM.cornerRadius - MM.bevel,
  frontZ: MM.depth / 2,
  backZ: -MM.depth / 2,
} as const

/** Front glass, derived from the flat face. */
export const SCREEN = {
  width: MM.width - MM.bezelSide * 2,
  height: MM.height - MM.bezelTop - MM.bezelBottom,
  radius: MM.screenRadius,
  centerY: (MM.bezelTop - MM.bezelBottom) / -2,
  z: FLAT.frontZ + 0.02,
} as const

/** Cover glass. It sits inside the frame, so a hairline of the body
    shows around it, and in front of the display so the reflection is
    not depth-rejected where the panel is. */
export const COVER = {
  width: FLAT.width - 0.7,
  height: FLAT.height - 0.7,
  radius: FLAT.radius - 0.35,
  z: FLAT.frontZ + 0.05,
} as const

/** Convenience: mm measured down from the top edge, as the sheet is. */
export const fromTop = (mm: number): number => MM.height / 2 - mm
/** Convenience: mm measured in from the left edge of the BACK view. */
export const fromBackLeft = (mm: number): number => MM.width / 2 - mm

/** World-space points the 2D dimension callouts project from. */
export const ANCHORS = {
  top: [0, MM.height / 2, 0],
  bottom: [0, -MM.height / 2, 0],
  left: [-MM.width / 2, 0, 0],
  right: [MM.width / 2, 0, 0],
  topRight: [MM.width / 2, MM.height / 2, 0],
  bottomRight: [MM.width / 2, -MM.height / 2, 0],
  topLeft: [-MM.width / 2, MM.height / 2, 0],
  bottomLeft: [-MM.width / 2, -MM.height / 2, 0],
  frontCentre: [0, 0, FLAT.frontZ],
  portCentre: [0, -MM.height / 2, 0],
} as const satisfies Record<string, readonly [number, number, number]>
