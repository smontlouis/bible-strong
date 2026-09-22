import type Phaser from 'phaser'
import { describe, expect, it, vi } from 'vitest'
import { BlobAvatar, loadBlobAvatar } from './blob-avatar'

function setup() {
  const textures = new Set<string>()
  const scene = {
    load: {
      image: vi.fn(),
      spritesheet: vi.fn(),
      start: vi.fn(),
      isLoading: () => false,
      isReady: () => true,
    },
    textures: { exists: (key: string) => textures.has(key) },
    cameras: { main: { width: 500, height: 500, zoom: 1, scrollX: 0, scrollY: 0 } },
  }
  const sprite = {
    x: 100,
    y: 100,
    scene,
    texture: { key: 'blob-idle-down' },
    frame: { name: '__BASE' },
    setTexture: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
  }
  return { scene, sprite, textures, image: sprite as unknown as Phaser.GameObjects.Image }
}

describe('lazy avatar animations', () => {
  it('preloads only static poses', () => {
    const { scene } = setup()
    loadBlobAvatar(scene as unknown as Phaser.Scene)
    expect(scene.load.image).toHaveBeenCalledTimes(15)
    expect(scene.load.spritesheet).not.toHaveBeenCalled()
  })
  it('shares direction requests between visitors and uses the idle pose until ready', () => {
    const { scene, sprite, image, textures } = setup()
    const first = new BlobAvatar(),
      second = new BlobAvatar()
    first.update(image, { x: 1, y: 0 }, true, false, 16, 'cloud')
    second.update(image, { x: 1, y: 0 }, true, false, 16, 'cloud')
    expect(scene.load.spritesheet).toHaveBeenCalledTimes(1)
    expect(sprite.setTexture).toHaveBeenLastCalledWith('cloud-idle-right', '__BASE')
    textures.add('cloud-right')
    first.update(image, { x: 1, y: 0 }, true, false, 16, 'cloud')
    expect(sprite.setTexture).toHaveBeenLastCalledWith('cloud-right', expect.any(Number))
  })
  it('does not download sheets offscreen, during arrival, or with reduced motion', () => {
    const { scene, image, sprite } = setup()
    const avatar = new BlobAvatar()
    avatar.update(image, { x: 1, y: 0 }, true, false, 16, 'cloud', false)
    avatar.update(image, { x: 1, y: 0 }, true, true, 16, 'cloud')
    sprite.x = 5000
    avatar.update(image, { x: 1, y: 0 }, true, false, 16, 'cloud')
    expect(scene.load.spritesheet).not.toHaveBeenCalled()
  })
})
