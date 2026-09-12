import * as THREE from 'three'

/* ==================================================================
   Dimension callouts.

   The sheet's own language: a ruled line with end ticks and a
   millimetre figure. They are drawn in the DOM but positioned from
   projected world points every frame, so they stay locked to the body
   through the whole camera move instead of being a static overlay.
   ================================================================== */

type Vec3 = readonly [number, number, number]

interface Dim {
  /** Which [data-anchor] element governs this callout's visibility. */
  anchor: string
  from: Vec3
  to: Vec3
  label: string
  /** Label offset from the projected midpoint, in px. */
  lx: number
  ly: number
  align: 'left' | 'right' | 'center'
}

const DIMS: Dim[] = [
  {
    anchor: 'reveal',
    from: [-36, -216, 0],
    to: [-36, 216, 0],
    label: '432 毫米',
    lx: -16,
    ly: 0,
    align: 'right',
  },
  {
    anchor: 'reveal',
    from: [-36, -216, 0],
    to: [36, -216, 0],
    label: '72 毫米',
    lx: 0,
    ly: 24,
    align: 'center',
  },
  {
    anchor: 'reveal',
    // A leader rather than a true dimension line: at this azimuth the
    // 7.8 mm thickness runs almost straight down the view axis, so a
    // line along Z would foreshorten to under 2 mm and vanish.
    from: [36, 120, 0],
    to: [86, 120, 0],
    label: '7.8 毫米',
    lx: 12,
    ly: -10,
    align: 'left',
  },
]

interface Entry {
  dim: Dim
  el: HTMLElement
  rule: HTMLElement
  label: HTMLElement
  host: HTMLElement | null
  /** Cached label width, measured off the critical path. */
  labelW: number
}

export interface Overlay {
  update(camera: THREE.Camera): void
  resize(): void
  dispose(): void
}

export function createOverlay(
  root: HTMLElement,
  anchors: Map<string, HTMLElement>
): Overlay {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()

  const entries: Entry[] = DIMS.map((dim) => {
    const el = document.createElement('div')
    el.className = 'callout'
    const rule = document.createElement('div')
    rule.className = 'callout__rule'
    const label = document.createElement('div')
    label.className = 'callout__label'
    label.textContent = dim.label
    el.append(rule, label)
    root.append(el)
    return {
      dim,
      el,
      rule,
      label,
      host: anchors.get(dim.anchor) ?? null,
      labelW: 0,
    }
  })

  let w = window.innerWidth
  let h = window.innerHeight

  /** Reading offsetWidth forces layout, so it happens here and never
      inside the frame loop. */
  const measureLabels = () => {
    for (const e of entries) e.labelW = e.label.offsetWidth
  }
  measureLabels()

  const project = (
    camera: THREE.Camera,
    v: THREE.Vector3,
    out: { x: number; y: number; ok: boolean }
  ) => {
    v.project(camera)
    out.ok = v.z < 1
    out.x = (v.x * 0.5 + 0.5) * w
    out.y = (-v.y * 0.5 + 0.5) * h
  }

  const pa = { x: 0, y: 0, ok: false }
  const pb = { x: 0, y: 0, ok: false }

  return {
    update(camera) {
      for (const e of entries) {
        // Visible while its anchor owns the middle of the viewport.
        let active = false
        if (e.host) {
          const r = e.host.getBoundingClientRect()
          active = r.top <= h * 0.5 && r.bottom >= h * 0.5
        }
        e.el.dataset.visible = active ? 'true' : 'false'
        if (!active) continue

        a.set(e.dim.from[0], e.dim.from[1], e.dim.from[2])
        b.set(e.dim.to[0], e.dim.to[1], e.dim.to[2])
        project(camera, a, pa)
        project(camera, b, pb)
        if (!pa.ok || !pb.ok) {
          e.el.dataset.visible = 'false'
          continue
        }

        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const len = Math.hypot(dx, dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI

        e.rule.style.transform = `translate(${pa.x}px, ${pa.y}px) rotate(${angle}deg)`
        e.rule.style.width = `${len}px`

        const mx = (pa.x + pb.x) / 2 + e.dim.lx
        const my = (pa.y + pb.y) / 2 + e.dim.ly
        const anchorX =
          e.dim.align === 'right'
            ? mx - e.labelW
            : e.dim.align === 'center'
              ? mx - e.labelW / 2
              : mx
        e.label.style.transform = `translate(${anchorX}px, ${my}px)`
      }
    },

    resize() {
      w = window.innerWidth
      h = window.innerHeight
      measureLabels()
    },

    dispose() {
      for (const e of entries) e.el.remove()
    },
  }
}
