import './style/tokens.css'
import './style/app.css'
import 'lenis/dist/lenis.css'

import { createScrollDriver } from './direction/scroll'
import { createRig, resolveKeys } from './direction/timeline'
import { createOverlay } from './scene/overlay'
import { createStage, hasWebGL } from './scene/stage'
import { loadWallpaper } from './scene/screen'
import { initReveal } from './ui/reveal'

/**
 * Boot in two stages.
 *
 * Building the phone is about 500 ms of synchronous work (environment,
 * display texture, and the boolean that carves the port and the camera
 * pockets). Doing it before the first paint means a blank viewport for
 * that whole time. So the copy is revealed first, the browser is given a
 * frame to paint it, and only then does the main thread get taken.
 *
 * `is-ready` therefore means "the page is readable"; `is-3d` means the
 * phone exists and can be faded in.
 */
function boot(): void {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null
  const poster = document.getElementById('poster')
  const calloutRoot = document.getElementById('callouts')

  // Camera keys are anchored to these elements, not to scroll offsets,
  // so the camera cannot drift away from the copy.
  const anchors = new Map<string, HTMLElement>()
  document.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
    if (el.dataset.anchor) anchors.set(el.dataset.anchor, el)
  })

  const scroll = createScrollDriver()
  initReveal(scroll.isReduced)

  // Started before anything else and awaited in build(), so the fetch
  // overlaps the first paint instead of sitting in front of it.
  const wallpaper = loadWallpaper()

  if (!canvas || !calloutRoot || !hasWebGL()) {
    // No 3D: the page is still complete. Every word is real DOM and was
    // already visible, and the folds keep their light/dark rhythm.
    document.body.classList.add('no-webgl')
    canvas?.setAttribute('hidden', '')
    if (poster) poster.removeAttribute('hidden')
    document.body.classList.add('is-ready')
    return
  }

  document.body.classList.add('is-ready')

  const build = async () => {
    // The display's wallpaper is a photograph rather than a gradient, so
    // the texture cannot be built until it is decoded. It resolves null
    // after 3 s or on error, and the procedural fallback covers that.
    const stage = createStage(canvas, await wallpaper)
    const overlay = createOverlay(calloutRoot, anchors)

    let rig = createRig(stage.camera, resolveKeys(anchors))

    const loop = (dt: number, elapsed: number) => {
      scroll.update(performance.now(), dt)
      const state = rig(scroll.progress, elapsed, scroll.isReduced)
      stage.setKeyIntensity(state.keyLight)
      overlay.update(stage.camera)
    }

    const remeasure = () => {
      stage.resize()
      overlay.resize()
      scroll.refresh()
      rig = createRig(stage.camera, resolveKeys(anchors))
    }

    // Layout settles late: webfonts, the spec table reflowing, Lenis
    // taking over the document scroll. Re-anchor the track after each.
    window.addEventListener('load', remeasure)
    if (document.fonts?.ready) void document.fonts.ready.then(remeasure)

    let resizeTimer = 0
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(remeasure, 140)
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stage.stop()
      else stage.start(loop)
    })

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__dsh = {
        camera: stage.camera,
        scroll,
        keys: resolveKeys(anchors),
        rig,
      }
    }

    // Compose one frame synchronously so the hero is framed before the
    // phone is faded in, rather than showing an unframed first frame.
    rig(0, 0, scroll.isReduced)
    overlay.update(stage.camera)
    stage.start(loop)

    document.body.classList.add('is-3d')
  }

  // Two frames: the first schedules the paint, the second runs after it.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      void build()
    })
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
