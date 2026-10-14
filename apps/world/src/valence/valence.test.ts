import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { Pathfinder } from '../pathfinding'
import { canStand, type NavigationDocument } from '../world'
import anchors from './generated/anchors.json'
import tiles from './generated/map-tiles.json'
import occluders from './generated/occluders.json'
import { EMPTY_PROGRESS, parseProgress } from './valence-progress'
import { pioneerObjects, speakers, stations } from './valence-story'
import { objectSpots, stationAnchors, threadOrder, VALENCE_HEIGHT, VALENCE_SPAWN, VALENCE_WIDTH } from './valence-world'

const root = resolve(import.meta.dirname, '../..')
const publicFile = (path: string) => resolve(root, 'public', path.replace(/^\.\//, ''))
const navigation = JSON.parse(
  await readFile(publicFile('valence-1876/navigation.json'), 'utf8')
) as NavigationDocument
const sceneFiles = ['caserne', 'cathedrale', 'champ', 'clercs', 'gare', 'maison', 'marche', 'rhone', 'temple', 'vapeur']

describe('Valence 1876 story', () => {
  it('covers the eight stations in date order, each with sources', () => {
    expect(stations.map(station => station.id)).toEqual(threadOrder)
    for (const station of stations) {
      expect(station.fact.length).toBeGreaterThan(0)
      expect(station.sources.length).toBeGreaterThan(0)
      for (const line of [...station.fact, ...station.study]) {
        expect(line.text.fr.trim()).not.toBe('')
        expect(line.text.en.trim()).not.toBe('')
      }
    }
  })

  it('keeps real people out of the scenes the sources exclude', () => {
    const present = new Set(stations.flatMap(s => [...s.fact, ...s.study].map(line => line.speaker)))
    expect([...present].filter(id => speakers[id].kind === 'real').sort()).toEqual(['bourdeau', 'marion'])
  })

  it('asks the visitor a single question, at the Rhône', () => {
    const questions = stations.flatMap(station =>
      [...station.fact, ...station.study]
        .filter(line => line.speaker !== 'narrator' && /\?$/.test(line.text.fr) && /\bvous\b/i.test(line.text.fr))
        .map(() => station.id)
    )
    expect(questions).toEqual(['rhone'])
  })

  it('ships every portrait and today screenshot it references', async () => {
    for (const id of Object.keys(speakers).filter(id => id !== 'narrator' && id !== 'louis'))
      await stat(publicFile(`valence-1876/portraits/${id}.webp`))
    for (const item of [...stations.map(s => s.today), ...pioneerObjects].filter(Boolean))
      await stat(publicFile(item!.screenshot))
    for (const object of pioneerObjects) await stat(publicFile(`valence-1876/objects/${object.id}.webp`))
  })

  it('links today panels to Bible Strong on the web', () => {
    for (const item of [...stations.map(s => s.today), ...pioneerObjects].filter(Boolean))
      for (const url of Object.values(item!.url)) expect(url).toMatch(/^https:\/\/web\.bible-strong\.app\//)
  })
})

describe('Valence 1876 progress', () => {
  it('drops unknown or malformed entries', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(
      parseProgress({ visited: ['gare', 'gare', 'nowhere', 3], found: ['lampe', 'x'], introSeen: true })
    ).toEqual({ visited: ['gare'], found: ['lampe'], introSeen: true })
  })
})

describe('Valence 1876 map', () => {
  it('uses one coordinate system for tiles, navigation and anchors', () => {
    expect([tiles.worldWidth, tiles.worldHeight]).toEqual([VALENCE_WIDTH, VALENCE_HEIGHT])
    expect([navigation.width, navigation.height]).toEqual([VALENCE_WIDTH, VALENCE_HEIGHT])
    expect(anchors.thread).toHaveLength(threadOrder.length - 1)
  })

  it('lets the avatar stand at the arrival, every station and every object', () => {
    for (const point of [VALENCE_SPAWN, ...Object.values(stationAnchors), ...Object.values(objectSpots)])
      expect(canStand(point, navigation), JSON.stringify(point)).toBe(true)
  })

  it('reaches every station and object from the station by click-to-walk', { timeout: 30000 }, () => {
    const pathfinder = new Pathfinder(navigation)
    for (const point of [...Object.values(stationAnchors), ...Object.values(objectSpots)])
      expect(pathfinder.find(VALENCE_SPAWN, point), JSON.stringify(point)).not.toBeNull()
  })

  it('keeps navigation polygons small enough for the pathfinder buckets', () => {
    expect(Math.max(...navigation.zones.map(zone => zone.points.length))).toBeLessThanOrEqual(64)
  })

  it('ships source-aligned occluders inside the map', async () => {
    expect(occluders.length).toBeGreaterThan(40)
    for (const occluder of occluders) {
      expect(occluder.x).toBeGreaterThanOrEqual(0)
      expect(occluder.y).toBeGreaterThanOrEqual(0)
      expect(occluder.x + occluder.width).toBeLessThanOrEqual(VALENCE_WIDTH + 1)
      expect(occluder.baseY).toBeGreaterThan(occluder.y)
      const meta = await sharp(publicFile(occluder.url)).metadata()
      expect(meta.hasAlpha).toBe(true)
    }
  })
})

describe('Valence 1876 animated scenes', () => {
  it('packs 120 frames per scene in atlases of at most 2048 pixels', async () => {
    for (const id of sceneFiles) {
      const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, `generated/scenes/${id}.json`), 'utf8'))
      expect(manifest.frameCount).toBe(120)
      expect(manifest.pages.reduce((n: number, page: { frameCount: number }) => n + page.frameCount, 0)).toBe(120)
      for (const page of manifest.pages) {
        const meta = await sharp(publicFile(`valence-1876/scenes/${id}/${page.key}.webp`)).metadata()
        expect(meta.width).toBeLessThanOrEqual(2048)
        expect(meta.height).toBeLessThanOrEqual(2048)
        const atlas = JSON.parse(await readFile(publicFile(`valence-1876/scenes/${id}/${page.key}.json`), 'utf8'))
        expect(Object.keys(atlas.frames)).toHaveLength(page.frameCount)
      }
      expect(manifest.x + manifest.width).toBeLessThanOrEqual(VALENCE_WIDTH + 1)
      expect(manifest.y + manifest.height).toBeLessThanOrEqual(VALENCE_HEIGHT + 1)
    }
  })
})
