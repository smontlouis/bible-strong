import { expect, it, vi } from 'vitest'
import { AvatarReactions, loadReactions } from './avatar-reactions'
import type Phaser from 'phaser'
import type { WorldMultiplayer } from './multiplayer'

it('follows local and interpolated remote avatars, tints only bodies, and removes expired bubbles', () => {
  const images: any[] = []
  const scene = {
    add: {
      image: () => {
        const image = Object.fromEntries(
          [
            'setAngle', 'setDepth',
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
    true
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

it('keeps activity badges until close, lets reactions take priority, and removes departed avatars', () => {
  const images: any[] = []
  const scene = { add: { image: () => {
    const image = Object.fromEntries(['setAngle', 'setDepth', 'setTexture', 'setPosition', 'setDisplaySize', 'setAlpha', 'setTint', 'destroy'].map(method => [method, vi.fn().mockReturnThis()]))
    images.push(image)
    return image
  } } }
  const network = { playerId: 'self', activity: 'game', reactions: new Map(), remotes: new Map(), expireReactions: () => {} }
  const renderer = new AvatarReactions(scene as unknown as Phaser.Scene)
  const render = (now: number) => renderer.update(network as unknown as WorldMultiplayer, { x: 100, y: 150, color: '#73cdd0' }, now, 1, 1, true)
  render(0)
  render(10000)
  expect(images).toHaveLength(1)
  expect(images[0].setPosition).toHaveBeenLastCalledWith(100, 86)
  network.reactions.set('self', { reaction: 'love', startedAt: 10000 })
  render(10001)
  expect(images[0].destroy).toHaveBeenCalledOnce()
  network.reactions.clear()
  render(14000)
  expect(images).toHaveLength(4)
  network.activity = null as any
  render(15000)
  expect(images[3].destroy).toHaveBeenCalledOnce()
})


it('loads activity SVGs as base64, as required by the Phaser data URL loader', () => {
  const svg = vi.fn()
  loadReactions({ load: { svg, image: vi.fn() } } as unknown as Phaser.Scene)
  expect(svg).toHaveBeenCalledTimes(5)
  for (const [key, url] of svg.mock.calls) {
    expect(key).toMatch(/^activity-/)
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(atob(url.split(',')[1])).toMatch(/^<svg /)
  }
})

it('drifts along a stable random tilt, fades away, and picks a new tilt for the next reaction', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0)
  try {
    const images: any[] = []
    const scene = { add: { image: () => {
      const image = Object.fromEntries(['setAngle', 'setDepth', 'setTexture', 'setPosition', 'setDisplaySize', 'setAlpha', 'setTint', 'destroy'].map(method => [method, vi.fn().mockReturnThis()]))
      images.push(image)
      return image
    } } }
    const reactions = new Map([['self', { reaction: 'love', startedAt: 0 }]])
    const network = { playerId: 'self', reactions, remotes: new Map(), expireReactions: () => {} }
    const renderer = new AvatarReactions(scene as unknown as Phaser.Scene)
    const render = (now: number, reduced = false) => renderer.update(network as unknown as WorldMultiplayer, { x: 100, y: 150, color: '#73cdd0' }, now, 1, 1, reduced)
    render(500)
    const early = images[0].setPosition.mock.lastCall
    render(2500)
    const late = images[0].setPosition.mock.lastCall
    expect(late[0]).toBeGreaterThan(early[0])
    expect(late[1]).toBeLessThan(early[1])
    for (const image of images) {
      expect(image.setAngle).toHaveBeenLastCalledWith(5)
      expect(image.setPosition.mock.lastCall).toEqual(late)
      expect(image.setAlpha.mock.lastCall[0]).toBeLessThan(1)
    }
    expect(random).toHaveBeenCalledTimes(1)
    reactions.set('self', { reaction: 'love', startedAt: 2500 })
    render(2600)
    expect(images[0].setAngle).toHaveBeenLastCalledWith(-10)
    expect(images[0].setPosition.mock.lastCall[0]).toBeLessThan(100)
    render(2700, true)
    expect(images[0].setAngle).toHaveBeenLastCalledWith(0)
    expect(images[0].setPosition).toHaveBeenLastCalledWith(100, 86)
  } finally {
    random.mockRestore()
  }
})
