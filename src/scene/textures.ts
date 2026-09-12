import * as THREE from 'three'

/** The Apple mark, as an SVG path. */
const APPLE_MARK =
  'M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z'

export interface LogoTexture {
  texture: THREE.CanvasTexture
  /** height / width of the INK, for sizing the plane that carries it. */
  aspect: number
}

/**
 * The etched mark on the back.
 *
 * Fitted by MEASUREMENT, not by an assumed viewBox.
 *
 * The obvious implementation scales the path by canvasWidth / 814, taking
 * 814 x 1000 from the viewBox this path is usually quoted with. It is the
 * wrong box for this string: the ink actually spans a good deal less, so
 * the mark came out at 45% of the intended size and sat off-centre inside
 * a mostly empty quad. That is what made the logo look small and shifted.
 *
 * So: draw it once into a probe canvas, read the alpha channel to find the
 * real ink bounds, then re-draw it fitted and centred. The measured aspect
 * goes back to the caller so the plane matches the ink rather than an
 * assumed ratio.
 */
export function createLogoTexture(): LogoTexture | null {
  let path: Path2D
  try {
    path = new Path2D(APPLE_MARK)
  } catch {
    // If a browser refuses the path string, ship no logo rather than a
    // wrong one.
    return null
  }

  const probe = document.createElement('canvas')
  probe.width = 512
  probe.height = 512
  const pctx = probe.getContext('2d')
  if (!pctx) return null
  pctx.fillStyle = '#ffffff'
  pctx.fill(path)

  const data = pctx.getImageData(0, 0, 512, 512).data
  let minX = 512
  let maxX = -1
  let minY = 512
  let maxY = -1
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      if (data[(y * 512 + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null

  const inkW = maxX - minX + 1
  const inkH = maxY - minY + 1
  const aspect = inkH / inkW

  const w = 256
  const h = Math.max(1, Math.round(w * aspect))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const s = w / inkW
  ctx.setTransform(s, 0, 0, s, -minX * s, -minY * s)
  ctx.fillStyle = '#ffffff'
  ctx.fill(path)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect }
}
