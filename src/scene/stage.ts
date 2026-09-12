import * as THREE from 'three'
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

/**
 * A studio built in code, in place of three's RoomEnvironment.
 *
 * RoomEnvironment averages quite dark, and at metalness 1 the aluminium
 * has no diffuse term at all, so the environment IS the body colour: with
 * RoomEnvironment the phone rendered mid-grey instead of the sheet's
 * near-white silver.
 *
 * The layout is a real product-shot lighting setup. A big bright ceiling
 * panel lifts the top face and rolls a highlight along the upper edge;
 * unequal side panels give the long vertical highlight the sheet shows
 * down the chamfer; a deliberately dark floor lets the back fall off
 * toward the bottom, which is exactly the gradient measured off the
 * sheet (#F0F1F3 near the top to #A7A3A1 at the bottom).
 *
 * Built at unit scale so the default PMREM near/far planes contain it.
 */
function createStudioEnvironment(): THREE.Scene {
  const env = new THREE.Scene()
  const panel = (color: number) => new THREE.MeshBasicMaterial({ color })

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(30, 20, 30),
    new THREE.MeshBasicMaterial({ color: 0xc6ccd4, side: THREE.BackSide })
  )
  env.add(shell)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), panel(0xffffff))
  ceiling.position.set(0, 9.5, 0)
  ceiling.rotation.x = Math.PI / 2
  env.add(ceiling)

  // Directly behind the camera. Without it the front bezel reflects the
  // dull back of the shell and reads mid-grey, where the sheet has it at
  // #F1F1F3.
  const front = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), panel(0xffffff))
  front.position.set(0, 1, 13)
  front.rotation.y = Math.PI
  env.add(front)

  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), panel(0xdde3ea))
  back.position.set(0, 1, -13)
  env.add(back)

  const left = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), panel(0xf4f8fc))
  left.position.set(-13, 1, 0)
  left.rotation.y = Math.PI / 2
  env.add(left)

  const right = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), panel(0xd8dfe8))
  right.position.set(13, 1, 0)
  right.rotation.y = -Math.PI / 2
  env.add(right)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), panel(0x6f757e))
  floor.position.set(0, -9.5, 0)
  floor.rotation.x = -Math.PI / 2
  env.add(floor)

  return env
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
  const studio = createStudioEnvironment()
  const envRT = pmrem.fromScene(studio, 0.03)
  scene.environment = envRT.texture
  studio.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
  pmrem.dispose()

  const key = new THREE.DirectionalLight(0xffffff, 1.1)
  key.position.set(420, 900, 760)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xe6eeff, 0.6)
  rim.position.set(-700, 260, -820)
  scene.add(rim)

  /* --- content ---------------------------------------------------- */
  const software = isSoftwareRenderer(renderer)
  if (software) renderer.setPixelRatio(1)
  const maxAniso = software ? 1 : renderer.capabilities.getMaxAnisotropy()
  const phone = createPhone({
    screen: createScreenTexture(maxAniso),
    logo: createLogoTexture(),
  })
  scene.add(phone.group)

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = software ? 1 : pixelRatio()
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
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
    renderer.render(scene, camera)
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
