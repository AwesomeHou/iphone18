import * as THREE from 'three'

/**
 * A rounded rectangle centred on the origin, wound counter-clockwise.
 *
 * The arcs are real circular arcs rather than quadratic approximations,
 * because at 3.2 mm of edge break the difference between an arc and a
 * quadratic is visible on the silhouette highlight.
 */
export function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = Math.max(width, 1e-3)
  const h = Math.max(height, 1e-3)
  const r = Math.min(radius, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2

  const s = new THREE.Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/**
 * A flat rounded rectangle facing +Z, with UVs remapped to 0..1.
 *
 * ShapeGeometry derives UVs from the shape's own XY coordinates, so a
 * texture applied straight to one lands as a tiny corner of itself. This
 * normalises them.
 */
export function roundedPlaneGeometry(
  width: number,
  height: number,
  radius: number,
  curveSegments = 32
): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(roundedRectShape(width, height, radius), curveSegments)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + width / 2) / width, (pos.getY(i) + height / 2) / height)
  }
  uv.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/**
 * The phone body.
 *
 * Shape is the FLAT face; the bevel expands outward to the widest point at
 * mid-thickness. Total depth is `depth + 2 * bevel`, so it is nudged back
 * to centre on z = 0.
 *
 * A positive bevelSize is load-bearing here. Negative inverts the section
 * into a bread loaf and the silhouette stops reading as an iPhone.
 */
export function createBodyGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel: number,
  bevelSegments = 6
): THREE.BufferGeometry {
  const shape = roundedRectShape(width - bevel * 2, height - bevel * 2, radius - bevel)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments,
    curveSegments: 32,
  })
  geo.computeBoundingBox()
  const bb = geo.boundingBox as THREE.Box3
  geo.translate(0, 0, -(bb.min.z + bb.max.z) / 2)
  geo.computeVertexNormals()
  return geo
}

/** A circle lying in the XZ plane, so it faces -Y. Used on the bottom edge. */
export function bottomFacingCircle(radius: number, segments = 24): THREE.BufferGeometry {
  const geo = new THREE.CircleGeometry(radius, segments)
  geo.rotateX(Math.PI / 2)
  return geo
}

/** A rounded slot lying in the XZ plane, so it faces -Y. */
export function bottomFacingRoundedRect(
  width: number,
  height: number,
  radius: number
): THREE.BufferGeometry {
  const geo = roundedPlaneGeometry(width, height, radius)
  geo.rotateX(Math.PI / 2)
  return geo
}
