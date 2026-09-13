import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { createStudioEquirect } from './environment'
import { createScreenTexture } from './screen'
import { createLogoTexture } from './textures'
import { createPhone, type Phone } from './phone'

export interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  phone: Phone
  /** Which pipeline the device can afford. See initialQuality. */
  readonly quality: Quality
  /** Pulses the key light, used to sell the material sweep. */
  setKeyIntensity(v: number): void
  start(update: (dt: number, elapsed: number) => void): void
  stop(): void
  resize(): void
  dispose(): void
}

/** Device pixel ratio, capped. The scene is a handful of thousand
    triangles; the cost is entirely fill rate, and 3x buys nothing. */
function pixelRatio(): number {
  const narrow = window.matchMedia('(max-width: 734px)').matches
  return Math.min(window.devicePixelRatio || 1, narrow ? 2 : 2)
}

/**
 * Debug switches, dev only: `?ao=0`, `?msaa=0`, `?post=0`, `?dpr=1`.
 *
 * The page's cost is entirely fill rate, and the AO pass, the MSAA
 * resolve and the render scale are the three knobs that trade quality for
 * it. Being able to isolate them from a URL is what makes a frame budget
 * measurable instead of arguable.
 */
function debugFlags(): Record<string, string> {
  if (!import.meta.env?.DEV) return {}
  const out: Record<string, string> = {}
  new URLSearchParams(window.location.search).forEach((v, k) => {
    out[k] = v
  })
  return out
}

type Quality = 'full' | 'fast'

/**
 * Integrated graphics: the pass chain is off the table before anything is
 * measured. The pixel budget alone cannot make this call, because the
 * crossover depends on the GPU rather than on the viewport: the same
 * 3.1 megapixels that costs an Intel UHD 79 ms a frame costs a discrete
 * card two or three.
 */
const WEAK_GPU =
  /intel|uhd graphics|iris|hd graphics|radeon graphics|vega \d|adreno|mali|powervr|videocore|swiftshader|llvmpipe|software/i

function gpuRendererName(renderer: THREE.WebGLRenderer): string {
  try {
    const gl = renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return String(
      ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER)
    )
  } catch {
    return ''
  }
}

/**
 * Device pixels to render, per tier.
 *
 * 3.6 Mpx is where the Intel UHD this was tuned on stops holding 60:
 * 1920 x 1080 is fine, 2560 x 1217 is right at the edge, and 4K falls to
 * 34 fps. A discrete card is not on that curve at all, so the two cases
 * get separate budgets rather than one number that is either too small
 * for one or too generous for the other. Capping a retina laptop at the
 * integrated figure would render it at 1x on a 2x display, which is a
 * worse outcome than the frame it was trying to buy.
 */
const BUDGET = {
  weak: 3.6e6,
  strong: 2.1e7,
  software: 1.4e6,
  /** Where the adaptive step-down stops. 1.8 Mpx is 0.76x at 2560 x 1217. */
  floor: 1.8e6,
} as const

export interface Plan {
  quality: Quality
  budget: number
}

function initialPlan(
  renderer: THREE.WebGLRenderer,
  software: boolean,
  flags: Record<string, string>
): Plan {
  if (flags.post === '0') return { quality: 'fast', budget: BUDGET.weak }
  // `?post=1` forces the expensive path, so the tier a fast machine gets
  // can still be looked at from a slow one.
  if (flags.post === '1') return { quality: 'full', budget: BUDGET.strong }
  const weak = software || WEAK_GPU.test(gpuRendererName(renderer))
  const budget = software ? BUDGET.software : weak ? BUDGET.weak : BUDGET.strong
  const px = window.innerWidth * window.innerHeight * pixelRatio() ** 2
  // The composer's buffers are the other limit: AO plus a 4x half-float
  // MSAA target at 8300 x 4600 is not something any card should be asked
  // to ping-pong, so past the strong budget the pass chain goes too.
  const quality: Quality = weak || px > 4.2e6 ? 'fast' : 'full'
  return { quality, budget }
}

/**
 * Device pixel ratio, budgeted.
 *
 * The last resort when a machine cannot afford the frame: render fewer
 * pixels than the window has and let the browser scale up. It is a real
 * loss of sharpness, so it only ever engages above the budget. Capping a
 * 4K viewport at the integrated budget takes it from 34 fps to 60 and
 * costs a 0.65 upscale, which is a great deal cheaper than a stutter.
 */
function renderDpr(w: number, h: number, budget: number): number {
  const want = pixelRatio()
  const css = Math.max(1, w * h)
  const capped = Math.min(want, Math.sqrt(budget / css))
  // Half resolution is the floor: below that the display texture's text is
  // no longer legible in the screen fold, and legibility is the point of
  // that section.
  return Math.max(0.5, Math.min(want, capped))
}

/**
 * Software rasterisers (SwiftShader, llvmpipe, headless VMs) fall over on
 * anisotropic filtering of a 1024x6200 texture. Dropping to point
 * sampling there costs nothing visible and turns a multi-second frame
 * into a normal one.
 */
export function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER))
    return /swiftshader|llvmpipe|software|basic render/i.test(name)
  } catch {
    return false
  }
}

export function createStage(
  canvas: HTMLCanvasElement,
  wallpaper: HTMLImageElement | null,
  albumArt: HTMLImageElement | null
): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearAlpha(0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Neutral keeps the aluminium from going chalky the way ACES does and
  // still rolls off the specular sweep, which is the one place the render
  // would otherwise clip.
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()

  // near/far are chosen for DEPTH PRECISION, not for clipping. The
  // closest key is the lens macro at ~52 mm and the furthest is the
  // specs fold at ~2.3 m; at near = 1 the buffer cannot resolve the
  // sub-millimetre layering of the display against the body, and the
  // screen z-fights into invisibility.
  const camera = new THREE.PerspectiveCamera(35, 1, 20, 12000)
  camera.position.set(0, 0, 900)

  /* --- lighting ---------------------------------------------------
     At metalness 1 the aluminium has no diffuse term, so the studio
     environment is doing almost all of the work. The directional lights
     only add the specular sweep that travels the edge in the material
     fold, and that sweep is why their intensity is animated. */
  performance.mark('dsh:env:start')
  const pmrem = new THREE.PMREMGenerator(renderer)
  const equirect = createStudioEquirect()
  const envRT = pmrem.fromEquirectangular(equirect)
  scene.environment = envRT.texture
  equirect.dispose()
  pmrem.dispose()
  performance.mark('dsh:env:end')
  performance.measure('dsh:env', 'dsh:env:start', 'dsh:env:end')

  // The environment carries the material. These two only add the
  // travelling specular that sells the material fold, so they are weak
  // and strictly neutral: a tinted rim was what turned the body blue.
  const key = new THREE.DirectionalLight(0xfffdfa, 0.85)
  key.position.set(420, 900, 760)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xffffff, 0.35)
  rim.position.set(-700, 260, -820)
  scene.add(rim)

  // A hint of bounce from below, which is what stops the lower half of
  // the body going dead.
  const bounce = new THREE.DirectionalLight(0xfff6ec, 0.18)
  bounce.position.set(120, -600, 420)
  scene.add(bounce)

  /* --- content ---------------------------------------------------- */
  const software = isSoftwareRenderer(renderer)
  const flags = debugFlags()
  if (software) renderer.setPixelRatio(1)
  const maxAniso = software ? 1 : renderer.capabilities.getMaxAnisotropy()

  performance.mark('dsh:screen:start')
  const screenTex = createScreenTexture(maxAniso, wallpaper, albumArt)
  performance.mark('dsh:screen:end')
  performance.measure('dsh:screen', 'dsh:screen:start', 'dsh:screen:end')

  performance.mark('dsh:phone:start')
  const phone = createPhone({ screen: screenTex, logo: createLogoTexture() })
  scene.add(phone.group)
  performance.mark('dsh:phone:end')
  performance.measure('dsh:phone', 'dsh:phone:start', 'dsh:phone:end')

  // Compile every material program up front. Without this, three compiles a
  // shader the first time each material is actually drawn, and because the
  // fold 5 and 6 materials are frustum-culled until the camera travels
  // there, that lands as a multi-second freeze in the middle of a scroll
  // rather than as a cost at startup.
  performance.mark('dsh:compile:start')
  renderer.compile(scene, camera)
  performance.mark('dsh:compile:end')
  performance.measure('dsh:compile', 'dsh:compile:start', 'dsh:compile:end')

  /* --- ambient occlusion and the post chain ------------------------
     Everything on this phone that reads as "machined" is a cavity, and a
     cavity with no occlusion reads as a painted dent. Ground-truth AO
     also darkens the contact under the button and inside the camera
     pockets, which is most of what separates a product render from a
     CAD turntable.

     It is also, on an integrated GPU, about six times the cost of
     drawing the phone. Measured on an Intel UHD at 2560 x 1217, one
     full render of the film:

       no composer at all (driver MSAA)        60 fps, solid
       composer, no AO, MSAA 4                 35 fps
       composer, AO, no MSAA                   27 fps
       composer, AO 24 samples, MSAA 4         12.6 fps

     So the pass chain is a tier, not a default. The AO prepass alone is
     a second full traversal of the scene at full resolution, and the
     MSAA 4 resolve on a HALF-FLOAT target is 16 bytes per sample per
     pixel: at 2560 x 1217 that is two 100 MB buffers ping-ponging
     through the composer. On unified memory that is the whole frame
     budget, and it shows up as 300 ms hitches rather than as a low
     average, which is what makes it read as stutter instead of as slow.

     `full` keeps the chain; `fast` draws straight to the default
     framebuffer, where the driver's own multisampling is close to free
     because it never leaves the tile. */
  let plan = initialPlan(renderer, software, flags)
  let quality: Quality = plan.quality
  let composer: EffectComposer | null = null
  let gtao: GTAOPass | null = null
  let rt: THREE.WebGLRenderTarget | null = null

  const wantAO = flags.ao !== '0'
  const aa = Number(flags.msaa ?? 4)
  const aoSamples = Number(flags.ao && flags.ao !== '0' ? flags.ao : 24)

  function buildPost() {
    // samples: 4 is not optional IF the composer is used. `antialias:
    // true` only covers the DEFAULT framebuffer, and every composer pass
    // renders into its own WebGLRenderTarget instead, which is created
    // without multisampling: turning the composer on silently threw away
    // all edge antialiasing.
    rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: aa,
    })
    composer = new EffectComposer(renderer, rt)
    composer.addPass(new RenderPass(scene, camera))
    if (wantAO) {
      gtao = new GTAOPass(scene, camera, 1, 1)
      gtao.output = GTAOPass.OUTPUT.Default
      gtao.blendIntensity = 0.5
      gtao.updateGtaoMaterial({
        // Radii are in world units, and a world unit is a millimetre, so
        // these are tuned to the size of the features: a 0.76 mm speaker
        // bore and a 5.5 mm deep port pocket.
        radius: 4.5,
        distanceExponent: 1,
        thickness: 8,
        scale: 1,
        samples: aoSamples,
        distanceFallOff: 1,
        screenSpaceRadius: false,
      })
      // Confine the horizon search to the phone's own volume. Without
      // this the transparent background is read as geometry sitting on
      // the far plane, every pixel is judged occluded, and the phone
      // renders black; widen the radius and it disappears entirely.
      gtao.setSceneClipBox(
        new THREE.Box3(new THREE.Vector3(-90, -280, -60), new THREE.Vector3(90, 280, 60))
      )
      composer.addPass(gtao)
    }
    composer.addPass(new OutputPass())
    // The passes were built against a 1 x 1 target; give them the real
    // size before the first frame rather than after it.
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(window.innerWidth, window.innerHeight)
  }

  function teardownPost() {
    composer?.dispose()
    composer = null
    gtao = null
    rt?.dispose()
    rt = null
  }

  if (quality === 'full' && !software && flags.post !== '0') buildPost()
  else quality = 'fast'

  /** One step down the quality ladder. Never steps back up. */
  function degrade() {
    if (quality === 'full') {
      quality = 'fast'
      // A machine that needed the downgrade cannot have the budget of one
      // that did not, whatever its renderer string claimed.
      plan = { quality: 'fast', budget: Math.min(plan.budget, BUDGET.weak) }
      teardownPost()
      resize()
      return
    }
    // Already on the cheap pipeline and still missing frames: the only
    // lever left is the render scale. Stepping down 30% at a time rather
    // than jumping to the floor keeps the loss as small as the machine
    // actually needs, and it never steps back up, so a busy moment
    // elsewhere on the desktop cannot make the page oscillate.
    if (plan.budget <= BUDGET.floor) return
    plan = {
      quality: 'fast',
      budget: Math.max(BUDGET.floor, plan.budget * 0.7),
    }
    resize()
  }


  /* --- frame-time watchdog ------------------------------------------
     The GPU heuristic above is right about the common cases and can be
     wrong about an unusual one, and being wrong is a page that stutters
     for the whole visit. So the real frame interval is measured too, and
     the quality ladder is walked down for the rest of the session.

     The statistic is a COUNT of dropped frames, not an average and not a
     median. The failure this exists to catch looks like a 16.7 ms median
     with a 50 ms p95: most frames are perfect and every few of them the
     compositor misses a beat, which is what a visitor calls stuttering.
     Both the mean and the median call that distribution healthy. */
  const samples: number[] = []

  /** How many of the window may be dropped before stepping down. */
  const SLOW_LIMIT = 5
  /** Frames per decision. Long enough not to react to a single hiccup. */
  const WATCH = 30

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = flags.dpr ? Number(flags.dpr) : renderDpr(w, h, plan.budget)
    const ss = flags.ss ? Number(flags.ss) : 1
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // EffectComposer.setSize already forwards the DEVICE size to every
    // pass. Calling gtao.setSize with the CSS size afterwards overwrites
    // that with an unscaled one, and the AO buffer is then sampled at the
    // wrong scale: the whole phone goes black and the denoiser leaves a
    // tiling artefact across it.
    composer?.setPixelRatio(dpr * ss)
    composer?.setSize(w, h)
    // A resize that makes the page bigger can push a machine that was
    // coping over the edge; the watchdog below picks that up.
    samples.length = 0
  }
  resize()

  let raf = 0
  let last = 0
  let update: ((dt: number, elapsed: number) => void) | null = null
  const t0 = performance.now()

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
    if (last && update) {
      samples.push(now - last)
      if (samples.length === WATCH) {
        // A dropped frame is one that took appreciably longer than the
        // display's own cadence. The cadence is taken from the fastest
        // interval in the window rather than assumed to be 16.7 ms, so a
        // 120 Hz laptop and a 30 Hz 4K panel are judged by the same rule
        // instead of the 30 Hz one pinning itself to the floor.
        let fastest = Infinity
        for (const s of samples) if (s < fastest) fastest = s
        const limit = Math.max(24, fastest * 1.8)
        let slow = 0
        for (const s of samples) if (s > limit) slow++
        if (slow >= SLOW_LIMIT) degrade()
        samples.length = 0
      }
    }
    last = now
    update?.(dt, (now - t0) / 1000)
    if (composer) composer.render(dt)
    else renderer.render(scene, camera)
  }

  return {
    renderer,
    scene,
    camera,
    phone,
    get quality() {
      return quality
    },
    setKeyIntensity(v) {
      key.intensity = v
    },
    start(fn) {
      update = fn
      if (!raf) raf = requestAnimationFrame(frame)
    },
    stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      last = 0
      samples.length = 0
    },
    resize,
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      phone.dispose()
      envRT.dispose()
      teardownPost()
      renderer.dispose()
    },
  }
}

/** Feature detection that does not throw on locked-down browsers. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext('webgl2') || c.getContext('webgl'))
    )
  } catch {
    return false
  }
}
