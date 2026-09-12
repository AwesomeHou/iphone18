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

export function createStage(canvas: HTMLCanvasElement): Stage {
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
  const pmrem = new THREE.PMREMGenerator(renderer)
  const equirect = createStudioEquirect()
  const envRT = pmrem.fromEquirectangular(equirect)
  scene.environment = envRT.texture
  equirect.dispose()
  pmrem.dispose()

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
  if (software) renderer.setPixelRatio(1)
  const maxAniso = software ? 1 : renderer.capabilities.getMaxAnisotropy()
  const phone = createPhone({
    screen: createScreenTexture(maxAniso),
    logo: createLogoTexture(),
  })
  scene.add(phone.group)

  /* --- ambient occlusion ------------------------------------------
     Everything on this phone that reads as "machined" is a cavity, and a
     cavity with no occlusion reads as a painted dent. Ground-truth AO
     also darkens the contact under the button and inside the camera
     pockets, which is most of what separates a product render from a
     CAD turntable.

     Skipped on software rasterisers: this is a full-screen pass and
     SwiftShader already struggles with the display texture alone. */
  let composer: EffectComposer | null = null
  let gtao: GTAOPass | null = null
  if (!software) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
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
      samples: 24,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    })
    // Confine the horizon search to the phone's own volume. Without this
    // the transparent background is read as geometry sitting on the far
    // plane, every pixel is judged occluded, and the phone renders black;
    // widen the radius and it disappears entirely.
    gtao.setSceneClipBox(
      new THREE.Box3(new THREE.Vector3(-90, -280, -60), new THREE.Vector3(90, 280, 60))
    )
    composer.addPass(gtao)
    composer.addPass(new OutputPass())
  }

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = software ? 1 : pixelRatio()
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // EffectComposer.setSize already forwards the DEVICE size to every
    // pass. Calling gtao.setSize with the CSS size afterwards overwrites
    // that with an unscaled one, and the AO buffer is then sampled at the
    // wrong scale: the whole phone goes black and the denoiser leaves a
    // tiling artefact across it.
    composer?.setPixelRatio(dpr)
    composer?.setSize(w, h)
  }
  resize()

  let raf = 0
  let last = 0
  let update: ((dt: number, elapsed: number) => void) | null = null
  const t0 = performance.now()

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
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
    },
    resize,
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      phone.dispose()
      envRT.dispose()
      composer?.dispose()
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
