import * as THREE from 'three'
import { KEYS, type CameraKey } from './keyframes'

export interface ResolvedKey extends CameraKey {
  /** Scroll fraction at which this key is reached. */
  at: number
}

/** Smoothstep. Every segment settles at both ends, so each fold reads as
    a rest point rather than a pass-through. */
const ease = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * How much of each key's truck to apply, given the viewport aspect.
 *
 * The trucks are authored against a landscape frame, where the phone
 * stands in the right column clear of the copy. A phone-shaped viewport
 * is roughly half as wide, so the same millimetre offset throws the
 * subject clean off the right edge: at 390 x 844 the hero's -84 mm is
 * 84% of the entire visible width. Fading the truck out below about
 * 4:3 recentres the phone under the copy, which is where it belongs in
 * a single-column layout.
 */
function truckScale(aspect: number): number {
  return Math.min(1, Math.max(0, (aspect - 0.75) / 0.6))
}

/**
 * Turn anchor-relative keys into scroll fractions.
 *
 * `at` is the scroll fraction at which the anchor element's centre sits
 * at `vp` of the viewport height. Anchoring to the DOM means the camera
 * cannot drift out of sync with the copy when a section's height or
 * padding changes.
 */
export function resolveKeys(anchors: Map<string, HTMLElement>): ResolvedKey[] {
  const doc = document.documentElement
  const max = Math.max(1, doc.scrollHeight - window.innerHeight)
  const vh = window.innerHeight

  const out = KEYS.map((k) => {
    const el = anchors.get(k.anchor)
    // getBoundingClientRect, not offsetTop: anchors sit inside
    // position:relative sections, so offsetTop would be relative to the
    // fold rather than the document and every key would collapse onto
    // the wrong scroll position.
    const centre = el
      ? el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2
      : 0
    const at = (centre - vh * k.vp) / max
    return { ...k, at }
  })

  // Keep it monotonic and inside the track. An inversion here means two
  // keys were anchored to elements that resolve out of order, which
  // silently collapses the shot, so say so in development rather than
  // letting it look like a camera bug.
  let prev = -Infinity
  let clamped = 0
  for (const k of out) {
    const wanted = k.at
    k.at = Math.min(1, Math.max(0, Math.max(k.at, prev + 1e-4)))
    if (Math.abs(k.at - wanted) > 1e-3) clamped++
    prev = k.at
  }
  if (clamped > 0 && import.meta.env?.DEV) {
    console.warn(
      `[timeline] ${clamped} camera key(s) resolved out of order and were clamped. ` +
        'Check that each key anchor sits later in the document than the previous one.',
      out.map((k) => `${k.note} @ ${k.at.toFixed(4)}`)
    )
  }
  if (out.length) {
    out[0].at = 0
    out[out.length - 1].at = 1
  }
  return out
}

export interface RigState {
  /** Multiplier for the key light, used to sell the material sweep. */
  keyLight: number
}

export function createRig(camera: THREE.PerspectiveCamera, keys: ResolvedKey[]) {
  const target = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const zAxis = new THREE.Vector3()
  const right = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)

  return function apply(progress: number, elapsed: number, reduced: boolean): RigState {
    const p = Math.min(1, Math.max(0, progress))

    let i = 0
    while (i < keys.length - 2 && p > keys[i + 1].at) i++
    const a = keys[i]
    const b = keys[i + 1] ?? keys[i]

    const span = Math.max(1e-6, b.at - a.at)
    const t = ease(Math.min(1, Math.max(0, (p - a.at) / span)))

    const tx = lerp(a.target[0], b.target[0], t)
    const ty = lerp(a.target[1], b.target[1], t)
    const tz = lerp(a.target[2], b.target[2], t)
    const distance = lerp(a.distance, b.distance, t)
    const elevation = lerp(a.elevation, b.elevation, t)
    const roll = lerp(a.roll, b.roll, t)
    const fov = lerp(a.fov, b.fov, t)
    const truck = lerp(a.truck, b.truck, t) * truckScale(camera.aspect)

    // Pedestal. In one column the copy and the phone want the same
    // space, so on a phone-shaped viewport the subject is pushed into
    // whichever half the copy is not using. Expressed in units of the
    // visible height so it holds at every focal length, and faded out
    // entirely once the truck is back on, which is the same threshold.
    const visH = 2 * distance * Math.tan((fov * Math.PI) / 360)
    const mobile = 1 - truckScale(camera.aspect)
    const pedestal = lerp(a.pedestal, b.pedestal, t) * mobile * visH

    // Idle drift, so a stationary fold is still alive. Suppressed
    // entirely under reduced motion.
    const drift = reduced ? 0 : 1
    const azimuth = lerp(a.azimuth, b.azimuth, t) + drift * 0.012 * Math.sin(elapsed * 0.31)

    // Unit vector from the subject toward the camera.
    const ce = Math.cos(elevation)
    zAxis.set(Math.sin(azimuth) * ce, Math.sin(elevation), Math.cos(azimuth) * ce)
    // Camera right, matching Matrix4.lookAt's own construction.
    right.crossVectors(UP, zAxis).normalize()

    target.set(tx, ty + pedestal + drift * 1.6 * Math.sin(elapsed * 0.23), tz)
    // Truck slides the subject sideways in frame WITHOUT changing the
    // distance to it. Nudging target.x instead, which is the obvious
    // thing to reach for, also moves the camera closer or further away
    // and quietly reframes the shot.
    target.addScaledVector(right, truck)
    pos.copy(target).addScaledVector(zAxis, distance)

    camera.position.copy(pos)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    if (roll !== 0) camera.rotateZ(roll)

    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // The material fold gets a brighter key so the highlight has
    // something to run along the edge.
    const matKey = keys.find((k) => k.note.startsWith('material'))
    const keyLight = matKey
      ? 0.9 + 1.5 * Math.exp(-Math.pow((p - matKey.at) / 0.075, 2))
      : 0.9

    return { keyLight }
  }
}

export type { CameraKey }
