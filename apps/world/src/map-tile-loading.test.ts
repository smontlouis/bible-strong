import { EventEmitter } from 'node:events'
import type Phaser from 'phaser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapTileStreamer } from './map-tile-streamer'
import { mapTileManifest, tilePlacement, arrivalTileTarget } from './map-tiles'

function setup() {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  const textures = new Set<string>()
  let loading = false
  const requests: string[] = [],
    pending: string[] = []
  const images: { alpha: number; destroyed: boolean }[] = []
  const loader = Object.assign(new EventEmitter(), {
    isLoading: () => loading,
    isReady: () => !loading,
    start: () => {
      loading = true
    },
    image: (key: string) => {
      requests.push(key)
      pending.push(key)
    },
  })
  const scene = {
    load: loader,
    textures: {
      exists: (key: string) => textures.has(key),
      remove: (key: string) => textures.delete(key),
    },
    add: {
      image: () => {
        const image = {
          alpha: 1,
          destroyed: false,
          setOrigin() {
            return this
          },
          setDisplaySize() {
            return this
          },
          setDepth() {
            return this
          },
          setAlpha(alpha: number) {
            this.alpha = alpha
            return this
          },
          setVisible() {
            return this
          },
          destroy() {
            this.destroyed = true
          },
        }
        images.push(image)
        return image
      },
    },
  } as unknown as Phaser.Scene
  const camera = {
    width: 1024,
    height: 1024,
    zoom: 4,
    scrollX: 0,
    scrollY: 0,
  } as Phaser.Cameras.Scene2D.Camera
  const complete = () => {
    for (const key of pending.splice(0)) {
      textures.add(key)
      loader.emit(`filecomplete-image-${key}`)
    }
    loading = false
  }
  return {
    stream: new MapTileStreamer(scene),
    camera,
    requests,
    complete,
    textures,
    images,
    loader,
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('map tile streaming', () => {
  it('honors disabled loading, requests visible tiles first, then the peripheral ring in bounded batches', () => {
    const { stream, camera, requests, complete, images } = setup()
    stream.update(camera, 100, 1, false)
    expect(requests).toHaveLength(0)
    stream.update(camera, 110, 1)
    expect(requests).toHaveLength(4)
    const first = [...requests]
    stream.update(camera, 120, 1)
    expect(requests).toEqual(first)
    complete()
    expect(images.every(image => image.alpha === 0)).toBe(true)
    stream.update(camera, 150, 1)
    expect(requests).toHaveLength(4)
    expect(images.every(image => image.alpha > 0 && image.alpha < 1)).toBe(true)
    stream.update(camera, 400, 1)
    expect(requests).toHaveLength(8)
  })
  it('loads the final arrival view during the zoom without fetching intermediate levels or the distant overview', () => {
    const { stream, camera, requests, complete } = setup()
    const target = arrivalTileTarget(camera, 4, { x: 836, y: 542 }, 2)
    camera.zoom = 0.6
    stream.update(camera, 100, 1, true, target)
    expect(requests).toHaveLength(4)
    expect(requests.every(key => key.startsWith('world-map-4-'))).toBe(true)
    complete()
    camera.zoom = 1.8
    stream.update(camera, 300, 1, true, target)
    complete()
    camera.zoom = 2.5
    stream.update(camera, 500, 1, true, target)
    complete()
    const count = requests.length
    stream.update(camera, 1500, 1, true, target)
    expect(requests).toHaveLength(count)
    expect(requests.every(key => key.startsWith('world-map-4-'))).toBe(true)
    expect(count).toBeLessThanOrEqual(9)
  })

  it('retains recently viewed tiles across long absences instead of re-downloading after eight seconds', () => {
    const { stream, camera, requests, complete } = setup()
    stream.update(camera, 100, 1)
    complete()
    const first = [...requests]
    camera.scrollX = 600
    stream.update(camera, 200, 1)
    complete()
    camera.scrollX = 0
    stream.update(camera, 30000, 1)
    for (const key of first) expect(requests.filter(request => request === key)).toHaveLength(1)
  })
  it('evicts old decoded textures when traversing the map and detaches pending callbacks on shutdown', () => {
    const { stream, camera, textures, complete, images, loader } = setup()
    camera.width = camera.height = 512
    let time = 100
    for (let row = 0; row < 8; row++)
      for (let column = 0; column < 14; column++) {
        camera.scrollX = column * 128 - 192
        camera.scrollY = row * 128 - 192
        stream.update(camera, (time += 100), 1)
        complete()
      }
    stream.update(camera, time + 100, 1, false)
    const bytes = [...textures].reduce((total, key) => {
      const [, , scale, column, row] = key.split('-')
      const level = mapTileManifest.levels.find(level => level.scale === Number(scale))!
      const p = tilePlacement(mapTileManifest, { level, column: Number(column), row: Number(row) })
      return total + p.width * level.scale * p.height * level.scale * 4
    }, 0)
    expect(bytes).toBeLessThanOrEqual(32 * 1024 * 1024)
    expect(images.some(image => image.destroyed)).toBe(true)
    stream.destroy()
    expect(textures.size).toBe(0)
    expect(loader.eventNames()).toHaveLength(0)
  })
})
