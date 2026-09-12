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
      visibly taller than the sides. Both got pulled in from the measured
      21.04 / 20.29: at the printed 6:1 envelope they put a 21 mm band above
      a 20 mm band around a 391 mm panel, and a forehead that is 5% of the
      screen reads as a phone from 2017, not from this one. 16 / 15.4 keeps
      the top taller than the chin, which is the relationship the sheet
      actually draws, and hands the difference to the display. */
  bezelSide: 3.73, // 7/135 of the width
  bezelTop: 16.0,
  bezelBottom: 15.4,
  /** Square. The panel went from 2 to 7 while the front read as a
      mock-up, on the theory that nothing shipping has a right-angled
      display; it is back to 0 by request, and at this size the lit corner
      is hidden under the bezel's own corner radius anyway. */
  screenRadius: 0,

  /** Earpiece slot. Note it sits BELOW the camera dot in the sheet.
      Both moved up with the bezel, by a little less than the bezel shrank
      so the forehead does not end up with the hardware pressed against
      the glass: the slot and the dot keep roughly the same margin below
      themselves as they had before. */
  earpieceWidth: 11.7, // 22/135
  earpieceHeight: 1.5, // 2/575
  earpieceFromTop: 12.2,
  frontCameraRadius: 2.25, // 3/575
  frontCameraFromTop: 6.9,

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
  logoWidth: 17.6, // 26/132 of the width, scaled up: at 14.18 the mark
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
