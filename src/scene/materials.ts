import * as THREE from 'three'

export interface PhoneMaterials {
  aluminum: THREE.MeshPhysicalMaterial
  screen: THREE.MeshPhysicalMaterial
  lens: THREE.MeshPhysicalMaterial
  lensRing: THREE.MeshPhysicalMaterial
  flash: THREE.MeshPhysicalMaterial
  slot: THREE.MeshStandardMaterial
  antenna: THREE.MeshStandardMaterial
  logo: THREE.MeshPhysicalMaterial
  frontCamera: THREE.MeshStandardMaterial
}

/**
 * The body reads as light anodised aluminium: near-white base, fully
 * metallic, and a clearcoat so the flat face picks up a crisp room
 * reflection instead of going chalky.
 *
 * The display is a light source, not a lit surface. It gets both `map` and
 * `emissiveMap` from the same canvas so the UI stays readable when the rest
 * of the phone is in shadow, plus a clearcoat layer standing in for cover
 * glass.
 */
export function createMaterials(textures: {
  screen: THREE.Texture | null
  logo: THREE.Texture | null
}): PhoneMaterials {
  const { screen: screenTexture, logo: logoTexture } = textures

  const aluminum = new THREE.MeshPhysicalMaterial({
    color: 0xdfe1e4,
    metalness: 1,
    roughness: 0.34,
    clearcoat: 0.28,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1,
  })

  const screen = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: screenTexture,
    emissive: 0xffffff,
    emissiveMap: screenTexture,
    emissiveIntensity: 1,
    metalness: 0,
    roughness: 0.045,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.75,
  })

  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x08080a,
    metalness: 0.4,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.4,
  })

  const lensRing = new THREE.MeshPhysicalMaterial({
    color: 0xc9cbcf,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.1,
  })

  const flash = new THREE.MeshPhysicalMaterial({
    color: 0xfaf7ee,
    metalness: 0,
    roughness: 0.35,
    transmission: 0,
    clearcoat: 1,
    emissive: 0xfff4d6,
    emissiveIntensity: 0.12,
  })

  const slot = new THREE.MeshStandardMaterial({
    color: 0x141416,
    metalness: 0.2,
    roughness: 0.62,
  })

  const antenna = new THREE.MeshStandardMaterial({
    color: 0xf3f4f5,
    metalness: 0.35,
    roughness: 0.66,
  })

  const logo = new THREE.MeshPhysicalMaterial({
    color: 0xb7b9be,
    map: logoTexture,
    transparent: true,
    metalness: 0.55,
    roughness: 0.42,
    envMapIntensity: 1,
  })

  const frontCamera = new THREE.MeshStandardMaterial({
    color: 0x101012,
    metalness: 0.1,
    roughness: 0.3,
  })

  return { aluminum, screen, lens, lensRing, flash, slot, antenna, logo, frontCamera }
}

export function disposeMaterials(m: PhoneMaterials): void {
  for (const mat of Object.values(m)) {
    for (const key of ['map', 'emissiveMap'] as const) {
      const tex = (mat as THREE.MeshPhysicalMaterial)[key]
      if (tex) tex.dispose()
    }
    mat.dispose()
  }
}
