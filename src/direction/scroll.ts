import Lenis from 'lenis'

export interface ScrollDriver {
  /** Damped 0..1, drives the camera. Lags `raw` slightly on purpose. */
  progress: number
  /** Immediate 0..1. */
  raw: number
  isReduced: boolean
  update(now: number, dt: number): void
  refresh(): void
  destroy(): void
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scroll position as a single normalised number.
 *
 * Damping is applied on top of Lenis rather than instead of it: Lenis
 * smooths the document, and the extra lag here is what makes the 3D
 * trail the copy by a beat. That trailing is most of why a scrub like
 * this reads as expensive.
 */
export function createScrollDriver(): ScrollDriver {
  const reduced = prefersReducedMotion()
  let lenis: Lenis | null = null

  if (!reduced) {
    try {
      lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
        autoRaf: false,
      })
      document.documentElement.classList.add('is-lenis')
    } catch {
      lenis = null
    }
  }

  let raw = 0
  let progress = 0
  let settled = false

  const readRaw = (): number => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const y = lenis ? lenis.scroll : window.scrollY
    return Math.min(1, Math.max(0, y / max))
  }

  return {
    get progress() {
      return progress
    },
    get raw() {
      return raw
    },
    isReduced: reduced,

    update(now, dt) {
      if (lenis) lenis.raf(now)
      raw = readRaw()

      if (!settled) {
        progress = raw
        settled = true
        return
      }

      // Critically damped follow. Framerate independent.
      const k = reduced ? 60 : 11
      progress += (raw - progress) * (1 - Math.exp(-k * dt))
      if (Math.abs(raw - progress) < 1e-5) progress = raw
    },

    refresh() {
      lenis?.resize()
      raw = readRaw()
    },

    destroy() {
      lenis?.destroy()
      lenis = null
      document.documentElement.classList.remove('is-lenis')
    },
  }
}
