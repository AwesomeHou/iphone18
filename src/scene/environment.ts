import * as THREE from 'three'

/* ==================================================================
   The studio.

   Painted as an equirectangular canvas rather than assembled from six
   boxes. Two reasons.

   First, flat panels give the metal nothing but smooth gradients, and a
   metal that reflects only gradients reads as moulded plastic: the
   material's identity comes from reflecting SHAPES, a bright softbox
   sitting right next to a dark flag.

   Second, it gives exact control over colour. Measured off
   docs/iphone18.png, the sheet's phone is bright and essentially
   neutral, warm on the back:

     front bezel   #F7F7F8   lum 247   R-B  -1
     side          #F8F8F8   lum 248   R-B   0
     back 15%      #CBC6C6   lum 199   R-B  +5
     back 92%      #A7A2A1   lum 163   R-B  +6

   The first attempt used cool panel colours and a blue rim light and
   rendered a body that was 35 luminance too dark and 24 points too blue
   (R-B -18 on the back). Nothing here is blue, and the only warm region
   is deliberately placed where the BACK of the phone reflects it.

   Equirect layout, for reference when editing:
     canvas x -> u -> azimuth.  +X is u 0.50, +Z is u 0.75,
                                -X is u 0.00/1.00, -Z is u 0.25
     canvas y -> v -> elevation. canvas TOP is straight up.
   So u 0.75 is what a front-facing surface reflects (it sees the world
   behind the viewer), and u 0.25 is what the back reflects.
   ================================================================== */

// 1024 x 512, not 2048 x 1024. PMREM's sharpest cube face is 256 px and an
// equirect of width W maps to about W/4 per face, so 1024 is exactly
// matched: painting at 2048 was four times the work for detail that is
// downsampled away before anything samples it.
const W = 1024
const H = 512

/** Feather a rectangle by stacking shrinking strokes. */
function softRect(
  ctx: CanvasRenderingContext2D,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  color: string,
  feather = 26
) {
  const x0 = u0 * W
  const x1 = u1 * W
  const y0 = v0 * H
  const y1 = v1 * H
  ctx.save()
  ctx.fillStyle = color
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  // Walk a few shrinking outlines so the edge reads as a diffused
  // source rather than a hard cut-out.
  const steps = 7
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    ctx.globalAlpha = 0.1 * (1 - t)
    ctx.fillRect(x0 + t * feather, y0 + t * feather, x1 - x0 - 2 * t * feather, y1 - y0 - 2 * t * feather)
  }
  ctx.restore()
}

function verticalBand(ctx: CanvasRenderingContext2D, u0: number, u1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  for (const [at, col] of stops) g.addColorStop(at, col)
  ctx.fillStyle = g
  ctx.fillRect(u0 * W, 0, (u1 - u0) * W, H)
}

export function createStudioEquirect(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  /* --- ground: sky bright, floor dark --------------------------------- */
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0.0, '#fbfaf9')
  base.addColorStop(0.22, '#f2f1f0')
  base.addColorStop(0.46, '#d9d8d7')
  base.addColorStop(0.62, '#b3b2b1')
  base.addColorStop(0.82, '#7c7b7a')
  base.addColorStop(1.0, '#5c5b5a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  /* --- the front hemisphere (u around 0.75) --------------------------
     What the flat front face reflects, and the brightest thing in the
     room. Neutral: the sheet's bezel measures R-B of -1. */
  softRect(ctx, 0.55, 0.95, 0.02, 0.30, '#ffffff', 34)
  softRect(ctx, 0.62, 0.88, 0.28, 0.52, '#f4f4f3', 30)
  softRect(ctx, 0.58, 0.94, 0.50, 0.60, '#dbdad9', 40)

  /* --- the back hemisphere (u around 0.25) ---------------------------
     Dimmer, and the only warm region in the environment. This is what
     puts the sheet's warm grey on the back of the body, so its R-B is
     set to land at +5, not at the +16 a stronger tint produced. */
  softRect(ctx, 0.10, 0.40, 0.10, 0.44, '#e2e0dc', 38)
  softRect(ctx, 0.15, 0.35, 0.44, 0.60, '#c9c7c3', 40)
  softRect(ctx, 0.12, 0.38, 0.62, 0.74, '#a9a7a3', 44)

  /* --- sides (u around 0.00 and 0.50) --------------------------------
     The band faces +/-X, and the sheet has it at a flat #F8F8F8. */
  softRect(ctx, 0.44, 0.56, 0.06, 0.46, '#fdfdfc', 30)
  softRect(ctx, 0.94, 1.0, 0.08, 0.48, '#fafaf9', 30)
  softRect(ctx, 0.0, 0.06, 0.08, 0.48, '#fafaf9', 30)

  /* --- horizon structure ---------------------------------------------
     A head-on view of the front glass reflects this band, and the hero
     camera sits about 15 degrees above the display centre, so it lands on
     v around 0.42. A reflection with no shape in it is precisely what
     makes a screen read as a printed panel rather than as glass: the eye
     needs a bright edge and a dark band next to it to accept the
     surface. */
  softRect(ctx, 0.60, 0.94, 0.34, 0.43, '#ffffff', 8)
  softRect(ctx, 0.60, 0.94, 0.44, 0.53, '#2f2f32', 8)
  softRect(ctx, 0.62, 0.92, 0.56, 0.62, '#6f6e6a', 12)
  // A screen faces the viewer and the camera sits above it, so the glass
  // mirrors DOWN, into canvas rows just past the horizon: this strip is
  // what a head-on view of the display reflects. It wants a visible edge
  // rather than a gradient, because glass is identified by the shape it
  // reflects, but it must stay close to the panel's own luminance: a
  // full-strength white strip here washes the black of the display out to
  // a pale grey and the OLED reads as frosted plastic.
  softRect(ctx, 0.63, 0.89, 0.53, 0.585, '#a9a7a3', 4)

  /* --- ceiling ------------------------------------------------------- */
  softRect(ctx, 0.0, 1.0, 0.0, 0.05, '#ffffff', 18)

  /* --- flags ---------------------------------------------------------
     Narrow dark cards between the softboxes. Without these the metal has
     no dark band to sit against, and a highlight with nothing dark next
     to it does not read as a highlight. */
  softRect(ctx, 0.005, 0.035, 0.30, 0.72, '#3c3b3a', 16)
  softRect(ctx, 0.465, 0.495, 0.34, 0.70, '#454443', 16)
  softRect(ctx, 0.955, 0.995, 0.30, 0.66, '#3c3b3a', 16)
  softRect(ctx, 0.02, 0.98, 0.855, 1.0, '#5a5958', 20)

  /* --- floor bounce -------------------------------------------------
     A white card under the phone, the way a product shot lights an
     underside. Straight-down is v = 0 in equirect terms, which is the
     canvas bottom, and it is the only thing a downward-facing surface
     like the bottom edge can reflect. Without it the whole bottom edge
     renders black and the port macro has no subject. */
  softRect(ctx, 0.18, 0.92, 0.94, 1.0, '#e8e8e5', 18)

  /* --- horizon glow --------------------------------------------------
     A soft bright strip at eye level, the way a cyclorama reads. It is
     what produces the long vertical highlight that runs the length of
     the chamfer. */
  verticalBand(ctx, 0.0, 1.0, [
    [0.0, 'rgba(255,255,255,0)'],
    [0.5, 'rgba(255,255,255,0)'],
    [0.62, 'rgba(255,255,255,0.22)'],
    [0.7, 'rgba(255,255,255,0.05)'],
    [1.0, 'rgba(255,255,255,0)'],
  ])

  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
