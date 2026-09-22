import { expect, it, vi } from 'vitest'
import { AvatarReactions } from './avatar-reactions'
import type Phaser from 'phaser'
import type { WorldMultiplayer } from './multiplayer'

it('follows local and interpolated remote avatars, tints only bodies, and removes expired bubbles', () => {
  const images: any[] = []
  const scene = {
    add: {
      image: () => {
        const image = Object.fromEntries(
          [
            'setDepth',
            'setTexture',
            'setPosition',
            'setDisplaySize',
            'setAlpha',
            'setTint',
            'destroy',
          ].map(method => [method, vi.fn().mockReturnThis()])
        )
        images.push(image)
        return image
      },
    },
  }
  const reactions = new Map([
    ['self', { reaction: 'love', startedAt: 0 }],
    ['remote', { reaction: 'bravo', startedAt: 0 }],
  ])
  const network = {
    playerId: 'self',
    reactions,
    remotes: new Map([
      ['remote', { sample: () => ({ x: 200, y: 300 }), player: { profile: { color: '#f09075' } } }],
    ]),
    expireReactions: (now: number) => {
      if (now >= 3000) reactions.clear()
    },
  }
  const renderer = new AvatarReactions(scene as unknown as Phaser.Scene)
  renderer.update(
    network as unknown as WorldMultiplayer,
    { x: 100, y: 150, color: '#73cdd0' },
    200,
    0.5,
    0.5,
    false
  )
  expect(images).toHaveLength(4)
  expect(images[0].setPosition).toHaveBeenCalledWith(100, 103)
  expect(images[2].setPosition).toHaveBeenCalledWith(200, 253)
  expect(images[0].setTint).toHaveBeenCalledWith(0x73cdd0)
  expect(images[2].setTint).toHaveBeenCalledWith(0xf09075)
  expect(images[1].setTint).not.toHaveBeenCalled()
  expect(images[3].setTint).not.toHaveBeenCalled()
  renderer.update(
    network as unknown as WorldMultiplayer,
    { x: 110, y: 150, color: '#73cdd0' },
    2999,
    1,
    1,
    true
  )
  expect(images[0].setAlpha).toHaveBeenLastCalledWith(1)
  expect(images[0].setPosition).toHaveBeenLastCalledWith(110, 86)
  renderer.update(
    network as unknown as WorldMultiplayer,
    { x: 110, y: 150, color: '#73cdd0' },
    3000,
    1,
    1,
    true
  )
  for (const image of images) expect(image.destroy).toHaveBeenCalledOnce()
})
