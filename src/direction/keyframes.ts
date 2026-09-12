/* ==================================================================
   The film.

   One camera, no cuts. Each key states where the camera looks, how far
   away it is, how it is orbited, and how far it is trucked sideways.

   Keys are anchored to a DOM element rather than to a scroll fraction.
   `anchor` names a [data-anchor] element and `vp` says where that
   element's centre should sit in the viewport at the moment the key is
   reached. A key therefore fires when its copy is genuinely on screen,
   and changing a section's height or padding in CSS cannot desynchronise
   the camera from the words.

   Angles are radians. 0 azimuth faces the FRONT of the phone; positive
   orbits toward the phone's right side. Elevation is positive upward.
   Roll is applied after lookAt, about the view axis.

   `truck` slides the camera and its target together along the camera's
   own right axis, which moves the phone sideways in frame at constant
   distance. Reach for truck, not target.x, when the phone needs to sit
   clear of the copy: shifting the target instead also changes how far
   away the camera is, and silently reframes the shot.

   Two constraints when editing:
   - Visible height is 2 * distance * tan(fov / 2), and visible width is
     that times the viewport aspect. The display texture is 1024 px
     across 64.54 mm, so anywhere under about 100 mm of visible height
     turns the screen soft.
   - The copy column occupies roughly the left 42% of a 1440 px
     viewport. Keep the phone's left edge right of that.
   ================================================================== */

export interface CameraKey {
  /** data-anchor of the element this key is tied to. */
  anchor: string
  /** Where that element's centre sits in the viewport, 0 = top, 1 = bottom. */
  vp: number
  /** Point the camera looks at, in millimetres. */
  target: [number, number, number]
  distance: number
  /** Millimetres along the camera's right axis. Negative moves the phone right. */
  truck: number
  /**
   * Mobile only, in units of the visible height. Positive pushes the
   * subject DOWN the frame, for folds whose copy sits at the top;
   * negative pushes it up. Ignored on landscape viewports, where the
   * copy and the phone already have their own columns.
   */
  pedestal: number
  azimuth: number
  elevation: number
  roll: number
  fov: number
  /** Documentation only. */
  note: string
}

export const KEYS: CameraKey[] = [
  {
    anchor: 'hero',
    vp: 0.5,
    // Cropped top and bottom: the clock is visible, the lower two
    // thirds are not, which is the whole argument of the hero.
    target: [0, 140, 0],
    distance: 560,
    truck: -84,
    pedestal: 0.45,
    azimuth: -0.34,
    elevation: 0.03,
    roll: 0,
    fov: 22,
    note: 'hero: top of the phone, lower two thirds off-frame',
  },
  {
    anchor: 'reveal',
    vp: 0.5,
    // The reveal. Whole phone, and it is a sliver. The dimension
    // callouts carry the composition, as on the sheet. 502 mm of
    // visible height puts 432 mm at 86% of the frame with just enough
    // margin for the rule below.
    target: [0, 0, 0],
    distance: 1290,
    truck: -180,
    pedestal: 0.12,
    azimuth: -0.22,
    elevation: 0.01,
    roll: 0,
    fov: 22,
    note: 'reveal: 432 mm, annotated',
  },
  {
    anchor: 'screen-start',
    vp: 0.35,
    // The screen fold is 200vh and holds two keys, so the lens enters
    // here, at the top of the lock screen, and leaves 260 mm further
    // down the body. Twelve notifications go past in between, by
    // scrolling rather than by animating the texture.
    target: [0, 130, 3.92],
    distance: 260,
    truck: -45,
    pedestal: -0.24,
    azimuth: 0.06,
    elevation: 0,
    roll: 0,
    fov: 30,
    note: 'screen: enters at the top of the lock screen',
  },
  {
    anchor: 'screen',
    vp: 0.78,
    // Anchored to the copy, which is what fixes this as the LATER of
    // the two screen keys.
    target: [0, -130, 3.92],
    distance: 260,
    truck: -45,
    pedestal: -0.24,
    azimuth: 0.06,
    elevation: 0,
    roll: 0,
    fov: 30,
    note: 'screen: exits near the bottom of the list',
  },
  {
    anchor: 'material',
    vp: 0.78,
    // Close on the band, and far enough round the orbit that the glass
    // has gone edge-on and the frame is metal rather than display.
    // Orbiting past the bright side panel is what produces the
    // highlight that runs the length of the edge.
    target: [0, 20, 0],
    distance: 140,
    truck: -26,
    pedestal: -0.24,
    azimuth: -1.15,
    elevation: 0.06,
    roll: 0,
    fov: 30,
    note: 'material: raking pass along the aluminium',
  },
  {
    anchor: 'edge',
    vp: 0.74,
    // Edge-on, and the camera rolls 90 degrees so 432 mm of length runs
    // across the frame and 7.8 mm of thickness becomes a hairline. Roll
    // is the only reason 7.8 mm is legible: unrolled it is 12 px wide
    // and reads as a rendering fault.
    //
    // After the roll, world Z is the image's vertical axis, so this is
    // the one key where target.z, not truck, is the vertical control.
    // The sign was settled by looking: negative Z lifts the line into
    // the upper third and leaves the copy the lower half.
    target: [0, 0, -78],
    distance: 1302,
    truck: 0,
    pedestal: -0.3,
    azimuth: Math.PI / 2,
    elevation: 0,
    roll: Math.PI / 2,
    fov: 22,
    note: 'edge: 7.8 mm as a hairline',
  },
  {
    anchor: 'lens',
    vp: 0.5,
    // The back's top-left corner, where the lens and flash sit inside
    // the white antenna cap. 112 mm of visible height frames the corner
    // and the cap edge together; a tighter shot just fills the frame
    // with one flat disc.
    target: [24.82, 190, -3.9],
    distance: 210,
    truck: -8,
    pedestal: -0.28,
    azimuth: Math.PI,
    elevation: 0.06,
    roll: 0,
    fov: 30,
    note: 'detail: the single rear lens',
  },
  {
    anchor: 'port',
    // 0.82, not 0.5: at this distance the phone's bottom edge spans most
    // of the frame width, so the copy has to sit below it rather than
    // beside it. Light text over bright aluminium is not a 4.5:1 pair.
    vp: 0.82,
    // Down the whole body to the port. Same fold, one continuous dolly.
    // The five-plus-five speaker holes make the bottom assembly about
    // 41 mm wide and the frame only 101 mm, so the truck is what buys
    // the copy its column.
    // Elevation is nearly straight up from below. At -1.15 the bottom
    // edge is so foreshortened that the port and both speaker grilles
    // collapse into the shadow line and the shot has no subject.
    target: [0, -213.5, 0],
    distance: 110,
    truck: -18,
    pedestal: -0.26,
    azimuth: Math.PI,
    elevation: -1.42,
    roll: 0,
    fov: 32,
    note: 'detail: USB-C at the bottom edge',
  },
  {
    anchor: 'duo',
    vp: 0.5,
    // Pulled back and trucked so the phone holds the right column while
    // the two copy blocks stack in the left one.
    target: [0, 0, 0],
    distance: 700,
    truck: -150,
    pedestal: 0.26,
    azimuth: 0,
    elevation: 0,
    roll: 0,
    fov: 22,
    note: 'battery and simplicity: cropped mid-body',
  },
  {
    anchor: 'specs',
    vp: 0.55,
    // Quiet, and clear of the 640 px table column.
    target: [0, -90, 0],
    distance: 2314,
    truck: -400,
    pedestal: 0,
    azimuth: -0.12,
    elevation: 0,
    roll: 0,
    fov: 22,
    note: 'specs: phone standing beside the table',
  },
  {
    anchor: 'buy',
    vp: 0.5,
    // Closes on the framing the hero opened with.
    target: [0, 130, 0],
    distance: 570,
    truck: -100,
    pedestal: 0,
    azimuth: -0.3,
    elevation: 0.04,
    roll: 0,
    fov: 22,
    note: 'buy: back to the hero crop',
  },
]
