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
  // A zero-radius arc is a degenerate path segment, and Earcut is not
  // obliged to make anything of it. A square panel is square.
  if (r <= 1e-4) {
    s.moveTo(x, y)
    s.lineTo(x + w, y)
    s.lineTo(x + w, y + h)
    s.lineTo(x, y + h)
    s.closePath()
    return s
  }
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

/* --- body zoning ---------------------------------------------------
   The body is not one surface. Measured off the sheet its three visible
   regions are three different brightnesses, and that difference is the
   whole read of the material:

     front bezel   #F7F7F8   lum 247   the painted bezel under cover glass
     side band     #F8F8F8   lum 248   machined, semi-polished
     back          #CBC6C6   lum 199   blasted anodised, and it falls to
     back 92%      #A7A2A1   lum 163   #A7A2A1 down its length

   Rendering all of it with one roughness is what made the first version
   look like a moulded shell.

   Probed structure of createBodyGeometry (see scratch/probe-body.mjs):
   the flat faces sit at z = +/- depth/2 and are width - 2 * bevel across;
   the outline bulges to the full width over the band between
   z = +/-(depth/2 - bevel). So the zones are separable by z alone.
   ------------------------------------------------------------------ */
export const ZONE = {
  frontFace: 0,
  backFace: 1,
  band: 2,
  chamfer: 3,
  /** The inside of a machined recess. */
  cavity: 4,
} as const

export const ZONE_COUNT = 5

/**
 * Reorder the triangles into per-zone runs and publish one material
 * group per zone. Works on ExtrudeGeometry's non-indexed output: the
 * index is built here rather than read.
 */
export function applyBodyZones(
  geo: THREE.BufferGeometry,
  halfDepth: number,
  bandHalf: number,
  isCavity?: (x: number, y: number, z: number) => boolean
): void {
  const pos = geo.getAttribute('position')
  const nrm = geo.getAttribute('normal')
  const tris = Math.floor(pos.count / 3)
  const buckets: number[][] = [[], [], [], [], []]
  const faceEps = 0.05

  for (let t = 0; t < tris; t++) {
    const i0 = t * 3
    const i1 = i0 + 1
    const i2 = i0 + 2
    const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3

    // Cavity first: a recess wall can sit at any z, and the surface
    // tests below would otherwise claim pieces of it.
    if (isCavity && isCavity(cx, cy, cz)) {
      buckets[ZONE.cavity].push(i0, i1, i2)
      // Flat-shade the machined wall. Welding the body's normals is right
      // for the rolled fillet but wrong here: it would smear the surface
      // normal down the inside of the bore and the hole would stop
      // reading as a hole.
      const abx = pos.getX(i1) - pos.getX(i0)
      const aby = pos.getY(i1) - pos.getY(i0)
      const abz = pos.getZ(i1) - pos.getZ(i0)
      const acx = pos.getX(i2) - pos.getX(i0)
      const acy = pos.getY(i2) - pos.getY(i0)
      const acz = pos.getZ(i2) - pos.getZ(i0)
      let nx = aby * acz - abz * acy
      let ny = abz * acx - abx * acz
      let nz = abx * acy - aby * acx
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      nrm.setXYZ(i0, nx, ny, nz)
      nrm.setXYZ(i1, nx, ny, nz)
      nrm.setXYZ(i2, nx, ny, nz)
      continue
    }

    const z0 = pos.getZ(i0)
    const z1 = pos.getZ(i1)
    const z2 = pos.getZ(i2)
    const onFace =
      Math.abs(Math.abs(z0) - halfDepth) < faceEps &&
      Math.abs(Math.abs(z1) - halfDepth) < faceEps &&
      Math.abs(Math.abs(z2) - halfDepth) < faceEps
    const onBand =
      Math.abs(z0) <= bandHalf + faceEps &&
      Math.abs(z1) <= bandHalf + faceEps &&
      Math.abs(z2) <= bandHalf + faceEps

    const zone = onFace
      ? z0 > 0
        ? ZONE.frontFace
        : ZONE.backFace
      : onBand
        ? ZONE.band
        : ZONE.chamfer

    buckets[zone].push(i0, i1, i2)
  }
  nrm.needsUpdate = true

  const index: number[] = []
  const groups: { start: number; count: number; mat: number }[] = []
  for (let z = 0; z < ZONE_COUNT; z++) {
    const b = buckets[z]
    if (!b.length) continue
    groups.push({ start: index.length, count: b.length, mat: z })
    for (let i = 0; i < b.length; i++) index.push(b[i])
  }

  geo.setIndex(index)
  geo.clearGroups()
  for (const g of groups) geo.addGroup(g.start, g.count, g.mat)
}

/**
 * Average normals across coincident vertices.
 *
 * ExtrudeGeometry emits a non-indexed mesh, so computeVertexNormals gives
 * flat shading and the fillet reads as seven flat facets instead of one
 * rolled highlight. Welding by position alone is correct here: the bevel
 * is cosine-shaped, so it is tangent to both the face and the band and
 * there is no genuinely sharp edge to preserve.
 */
function weldNormals(geo: THREE.BufferGeometry, tol = 0.005): void {
  const pos = geo.getAttribute('position')
  const nrm = geo.getAttribute('normal')
  const n = pos.count

  const key = (i: number) =>
    `${Math.round(pos.getX(i) / tol)},${Math.round(pos.getY(i) / tol)},${Math.round(pos.getZ(i) / tol)}`

  const acc = new Map<string, [number, number, number]>()
  for (let i = 0; i < n; i++) {
    const k = key(i)
    const cur = acc.get(k)
    if (cur) {
      cur[0] += nrm.getX(i)
      cur[1] += nrm.getY(i)
      cur[2] += nrm.getZ(i)
    } else {
      acc.set(k, [nrm.getX(i), nrm.getY(i), nrm.getZ(i)])
    }
  }
  for (let i = 0; i < n; i++) {
    const a = acc.get(key(i)) as [number, number, number]
    const len = Math.hypot(a[0], a[1], a[2]) || 1
    nrm.setXYZ(i, a[0] / len, a[1] / len, a[2] / len)
  }
  nrm.needsUpdate = true
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
 *
 * Returns a four-zone geometry, so `mesh.material` must be an array in
 * ZONE order.
 */
export function createBodyGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  bevel: number,
  bevelSegments = 10
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
  weldNormals(geo)
  // Zoning happens after carving, in phone.ts: the recesses have to exist
  // before their walls can be identified.
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
