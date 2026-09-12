import * as THREE from 'three'

/** The Apple mark, 814 x 1000 viewBox. Drawn as a mask, tinted by the material. */
const APPLE_MARK =
  'M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z'

/**
 * The etched mark on the back. White on transparent, so the material's own
 * colour and roughness decide how it catches light.
 *
 * Path2D with an SVG string is the only way to get this exact curve without
 * shipping a binary asset; if a browser refuses it we return null and the
 * phone simply ships without the logo rather than with a wrong one.
 */
export function createLogoTexture(): THREE.CanvasTexture | null {
  let path: Path2D
  try {
    path = new Path2D(APPLE_MARK)
  } catch {
    return null
  }

  const w = 256
  const h = Math.round((w * 1000) / 814)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const scale = w / 814
  ctx.scale(scale, scale)
  // viewBox is 814 x 1000; nudge so the ink sits optically centred.
  ctx.translate(0, 6)
  ctx.fillStyle = '#ffffff'
  ctx.fill(path)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
