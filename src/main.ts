import './style/tokens.css'
import './style/app.css'
import 'lenis/dist/lenis.css'

import { createScrollDriver } from './direction/scroll'
import { createRig, resolveKeys } from './direction/timeline'
import { createOverlay } from './scene/overlay'
import { createStage, hasWebGL } from './scene/stage'
import { initReveal } from './ui/reveal'

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

  if (!canvas || !calloutRoot || !hasWebGL()) {
    // No 3D: the page is still complete. Every word is real DOM and was
    // already visible, and the folds keep their light/dark rhythm.
    document.body.classList.add('no-webgl')
    canvas?.setAttribute('hidden', '')
    if (poster) poster.removeAttribute('hidden')
    document.body.classList.add('is-ready')
    return
  }

  const stage = createStage(canvas)
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

  // Compose one frame synchronously so the hero is framed before the
  // first paint rather than a frame later.
  rig(0, 0, scroll.isReduced)
  overlay.update(stage.camera)
  stage.start(loop)

  document.body.classList.add('is-ready')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
