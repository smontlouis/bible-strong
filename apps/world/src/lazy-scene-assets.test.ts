import { EventEmitter } from 'node:events'
import type Phaser from 'phaser'
import { describe, expect, it, vi } from 'vitest'
import { LazySceneAssets } from './lazy-scene-assets'

function setup() {
  const textures = new Set<string>()
  const loader = Object.assign(new EventEmitter(), {
    isLoading: (): boolean => false,
    isReady: () => true,
    start: vi.fn(),
  })
  const events = new EventEmitter()
  const scene = {
    load: loader,
    events,
    textures: { exists: (key: string) => textures.has(key) },
  } as unknown as Phaser.Scene
  const camera = {
    width: 100,
    height: 100,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  } as Phaser.Cameras.Scene2D.Camera
  const makeAsset = (x: number, keys: string[]) => ({
    bounds: { x, y: 0, width: 50, height: 50 },
    keys,
    load: vi.fn(),
    create: vi.fn(() => ({ id: keys[0] })),
  })
  return { textures, loader, events, scene, camera, makeAsset }
}

describe('lazy scene animations', () => {
  it('does not load when disabled or outside the camera; waits for every atlas page', () => {
    const { textures, scene, camera, makeAsset } = setup()
    const asset = makeAsset(200, ['page-0', 'page-1'])
    const assets = new LazySceneAssets(scene, [asset])
    const update = vi.fn()
    assets.update(camera, true, update)
    camera.scrollX = 200
    assets.update(camera, false, update)
    expect(asset.load).not.toHaveBeenCalled()
    assets.update(camera, true, update)
    assets.update(camera, true, update)
    expect(asset.load).toHaveBeenCalledTimes(1)
    textures.add('page-0')
    assets.update(camera, true, update)
    expect(asset.create).not.toHaveBeenCalled()
    textures.add('page-1')
    assets.update(camera, true, update)
    expect(asset.create).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ id: 'page-0' })
    camera.scrollX = 0
    assets.update(camera, true, update)
    camera.scrollX = 200
    assets.update(camera, true, update)
    expect(asset.load).toHaveBeenCalledTimes(1)
  })

  it('loads one visible group at a time and does not compete with an active map loader', () => {
    const { textures, loader, scene, camera, makeAsset } = setup()
    const first = makeAsset(0, ['first']),
      second = makeAsset(25, ['second'])
    const assets = new LazySceneAssets(scene, [first, second])
    const busy = vi.spyOn(loader, 'isLoading').mockReturnValue(true)
    assets.update(camera, true, () => {})
    expect(first.load).not.toHaveBeenCalled()
    busy.mockReturnValue(false)
    assets.update(camera, true, () => {})
    assets.update(camera, true, () => {})
    expect(second.load).not.toHaveBeenCalled()
    textures.add('first')
    assets.update(camera, true, () => {})
    expect(second.load).toHaveBeenCalledTimes(1)
  })

  it('starts arrival artwork alongside tiles, using the destination view instead of the wide camera', () => {
    const { textures, loader, scene, camera, makeAsset } = setup()
    camera.width = 1000
    const distant = makeAsset(0, ['distant'])
    const central = makeAsset(200, ['central'])
    const next = makeAsset(225, ['next'])
    const assets = new LazySceneAssets(scene, [distant, central, next])
    vi.spyOn(loader, 'isLoading').mockReturnValue(true)
    const options = { concurrent: true, view: { x: 200, y: 0, width: 100, height: 100 } }
    const update = vi.fn()
    assets.update(camera, true, update, options)
    expect(central.load).toHaveBeenCalledTimes(1)
    expect(distant.load).not.toHaveBeenCalled()
    expect(loader.start).not.toHaveBeenCalled()
    assets.update(camera, true, update, options)
    expect(next.load).not.toHaveBeenCalled()
    textures.add('central')
    assets.update(camera, true, update, options)
    expect(central.create).toHaveBeenCalledTimes(1)
    expect(next.load).toHaveBeenCalledTimes(1)
  })

  it('keeps failed animations static without blocking others, and cleans up on shutdown', () => {
    const { loader, events, scene, camera, makeAsset } = setup()
    const first = makeAsset(0, ['first']),
      second = makeAsset(25, ['second'])
    const assets = new LazySceneAssets(scene, [first, second])
    assets.update(camera, true, () => {})
    loader.emit('loaderror', { key: 'first' })
    assets.update(camera, true, () => {})
    expect(first.create).not.toHaveBeenCalled()
    expect(first.load).toHaveBeenCalledTimes(1)
    expect(second.load).toHaveBeenCalledTimes(1)
    events.emit('shutdown')
    expect(loader.listenerCount('loaderror')).toBe(0)
  })
})
