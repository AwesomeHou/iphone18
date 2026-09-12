import * as THREE from 'three'
import type { LogoTexture } from './textures'

export interface PhoneMaterials {
  /** ZONE.frontFace: painted bezel under cover glass. */
  bodyFront: THREE.MeshPhysicalMaterial
  /** ZONE.backFace: blasted anodised aluminium. */
  bodyBack: THREE.MeshPhysicalMaterial
  /** ZONE.band: the machined side band. */
  bodyBand: THREE.MeshPhysicalMaterial
  /** ZONE.chamfer: the polished break where band meets face. */
  bodyChamfer: THREE.MeshPhysicalMaterial
  /** The display itself: content, with no cover glass of its own. */
  screen: THREE.MeshPhysicalMaterial
  /** Cover glass over the whole front face, added as a specular layer. */
  coverGlass: THREE.MeshPhysicalMaterial
  lens: THREE.MeshPhysicalMaterial
  lensRing: THREE.MeshPhysicalMaterial
  flash: THREE.MeshPhysicalMaterial
  slot: THREE.MeshStandardMaterial
  cavity: THREE.MeshStandardMaterial
  antenna: THREE.MeshStandardMaterial
  logo: THREE.MeshPhysicalMaterial
  frontCamera: THREE.MeshStandardMaterial
}

/**
 * Material notes, all referenced to docs/iphone18.png.
 *
 * The sheet's body measures as three different surfaces, not one:
 *
 *   front bezel   #F7F7F8   lum 247   R-B -1
 *   side          #F8F8F8   lum 248   R-B  0
 *   back 15%      #CBC6C6   lum 199   R-B +5
 *   back 92%      #A7A2A1   lum 163   R-B +6
 *
 * The front is bright because it is white paint under glass, so it is a
 * mostly diffuse white rather than a mirror. The back is blasted, so it
 * is rough and lands around 50 luminance lower. The chamfer is polished,
 * and that is where the bright line down the edge comes from.
 *
 * Nothing here carries a tint of its own. Every colour in the sheet is
 * neutral or warm, and a tinted base is what turned the first attempt
 * blue.
 */
export function createMaterials(textures: {
  screen: THREE.Texture | null
  logo: LogoTexture | null
}): PhoneMaterials {
  const { screen: screenTexture } = textures
  const logoTexture = textures.logo?.texture ?? null

  const bodyFront = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.6,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
    // Lifted above 1 to offset the blanket few percent GTAO takes off
    // every surface, and above that to put back the 16% the cover glass
    // now takes off the whole front face: the bezel is measured at #F7F7F8
    // in the sheet, essentially paper white, and it was already the
    // darkest thing on the phone relative to reference.
    envMapIntensity: 1.7,
  })

  const bodyBack = new THREE.MeshPhysicalMaterial({
    color: 0xf8f7f5,
    metalness: 1,
    roughness: 0.46,
    clearcoat: 0.15,
    clearcoatRoughness: 0.45,
    envMapIntensity: 1,
  })

  const bodyBand = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.26,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.05,
  })

  const bodyChamfer = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.2,
  })

  /**
   * A display emits; it is not a lit surface.
   *
   * The previous version carried BOTH `map` and `emissiveMap` from the
   * same canvas, so every pixel was the content plus the content lit by
   * the room. That is the single biggest reason the screen read as a
   * printed panel: the diffuse term lifts the blacks off zero and washes
   * the whole panel toward the ambient colour, which is exactly what a
   * backlit LCD looks like and exactly what an OLED does not. Emissive
   * only, so the black level follows the content.
   *
   * The gloss belongs to the cover glass layer on top, not here.
   */
  const screen = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 1,
    metalness: 0,
    roughness: 0.4,
    // Zero, not "a little". Any diffuse response at all puts room light
    // back onto the panel, and that wash is the other half of the frosted
    // plastic read: a real display contributes nothing but its own
    // emission, and every photon that reaches the eye off a phone screen
    // either came out of the panel or bounced off the glass in front of
    // it. The glass is a separate layer and it is the only one allowed to
    // reflect.
    envMapIntensity: 0,
  })

  /**
   * The glass over the display, and the one place where being clever cost
   * more than it bought.
   *
   * This used to be an ADDITIVE layer: black, glossy, added on top of the
   * panel. The appeal is that an ordinary transparent layer scales its
   * reflection by the same opacity that makes it see-through, so the
   * reflection comes out faint. What additive cannot do is take light
   * AWAY, and that turned out to matter more. Glass reflects and
   * transmits from the same budget: where it throws 10% of the room back
   * at you it also passes 10% less of what is behind it. An additive
   * layer passes 100% of the panel and adds the reflection on top, so at
   * an oblique angle the display came out as panel + a broad grey wash,
   * which is exactly what frosted plastic looks like.
   *
   * So it is a real alpha layer now, dimming what is behind it. The
   * reflection is restored by raising envMapIntensity by the reciprocal
   * of the opacity, which makes the two terms cancel: the glass puts back
   * exactly the Fresnel fraction the blend takes away, and the panel
   * keeps 1 - opacity. That is exact up to about 20 degrees off normal,
   * which is everything the camera ever sees of this screen; at a true
   * grazing angle the tone mapper has already compressed the reflection
   * before the blend scales it, so the last few degrees are dimmer than
   * they should be. Nobody has ever held a phone at 88 degrees.
   *
   * 0.012 roughness, down from 0.03: the reflection has to be a mirror,
   * not a sheen. Glass is identified by recognising the shape it
   * reflects, and every bit of roughness turns that shape into a grey
   * wash that reads as a matte surface.
   */
  const GLASS_OPACITY = 0.16
  const coverGlass = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 0.012,
    ior: 1.52,
    envMapIntensity: 1 / GLASS_OPACITY,
    transparent: true,
    opacity: GLASS_OPACITY,
    depthWrite: false,
  })

  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x0b1018,
    metalness: 0.15,
    // A mirror finish here reflects the studio's softbox edges as a hard
    // crescent across the glass, which reads as a sphere rather than a
    // lens. A little roughness spreads that into a believable sheen.
    // Rougher than glass, deliberately. The studio has a hard horizon
    // and a flat lens mirrors it as a straight line across the disc,
    // which reads as a sphere cut in half rather than as an optic. A
    // wider specular lobe turns that line into the soft sheen a real
    // lens cover has, and the AR coating below supplies the character
    // the roughness takes away.
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    envMapIntensity: 0.7,
    // The anti-reflective coating every camera lens wears: a faint
    // violet-green sheen that only appears where the light grazes.
    iridescence: 0.5,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 460],
  })

  const lensRing = new THREE.MeshPhysicalMaterial({
    color: 0x9ea3a9,
    metalness: 1,
    roughness: 0.2,
    envMapIntensity: 1.1,
  })

  const flash = new THREE.MeshPhysicalMaterial({
    color: 0xfaf7ee,
    metalness: 0,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    emissive: 0xfff4d6,
    emissiveIntensity: 0.08,
  })

  /** The dark inside of a hole. */
  const slot = new THREE.MeshStandardMaterial({
    color: 0x141416,
    metalness: 0.2,
    roughness: 0.62,
  })

  /**
   * The wall of a recess. Deliberately dark and non-metallic: a machined
   * bore is mostly occluded and reads close to black, and a reflective
   * wall turns the speaker grilles into bright pips instead of holes.
   */
  const cavity = new THREE.MeshStandardMaterial({
    // A little off black, and matte. At #090A0B with no specular at all
    // the inside of a bore has the same value as the inside of a painted
    // dot; at metalness 0.3 with roughness 0.55 it has enough gloss to
    // catch the floor bounce and the grille renders as ten white pips
    // instead. This is the narrow band between the two failures.
    color: 0x111419,
    metalness: 0.2,
    roughness: 0.72,
  })

  /** The antenna cap. The sheet has it at #EEEEEF, a clear 39 luminance
      above the body beside it, so it is a bright ceramic band rather
      than a slightly lighter aluminium. */
  const antenna = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.12,
    roughness: 0.44,
    // 2.2, not 1.6. The cap faces away from the front hemisphere, so it
    // is lit by the dim half of the studio, and the sheet has it at
    // #EEEEEF: 39 luminance above the anodised body beside it. At 1.6 it
    // rendered as a very slightly lighter grey band rather than as white
    // ceramic.
    envMapIntensity: 2.2,
  })

  /**
   * The etched mark. depthWrite is off deliberately: it is a decal 0.3 mm
   * proud of the back, and if it writes depth the AO prepass sees a
   * rectangular plate floating there and darkens a faint rectangle around
   * it, roughly the size of the texture.
   */
  const logo = new THREE.MeshPhysicalMaterial({
    color: 0xb4b6ba,
    map: logoTexture,
    transparent: true,
    depthWrite: false,
    metalness: 0.6,
    roughness: 0.38,
    envMapIntensity: 1,
  })

  const frontCamera = new THREE.MeshStandardMaterial({
    color: 0x101012,
    metalness: 0.1,
    roughness: 0.3,
  })

  return {
    bodyFront,
    bodyBack,
    bodyBand,
    bodyChamfer,
    screen,
    coverGlass,
    lens,
    lensRing,
    flash,
    slot,
    cavity,
    antenna,
    logo,
    frontCamera,
  }
}

export function disposeMaterials(m: PhoneMaterials): void {
  for (const mat of Object.values(m)) {
    const phys = mat as THREE.MeshPhysicalMaterial
    phys.map?.dispose()
    phys.emissiveMap?.dispose()
    mat.dispose()
  }
}
