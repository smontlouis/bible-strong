import { readFileSync } from 'node:fs'
import type { ShareCardContent } from '@bible-strong/share-card-service/content'
import { describe, expect, it } from 'vitest'
import { readSignedShareCard, signShareCard } from './shareCardAddress'
import {
  readShareMapGround,
  SHARE_MAP_SIZE,
  shareMapPixel,
  shareMapSvg,
  shareMapWindow,
} from './shareCardMap'

describe('Map of an entity card', () => {
  const ground = readShareMapGround(
    readFileSync(new URL('../../public/atlas/map.svg', import.meta.url), 'utf8')
  )

  it('reads the ground of the atlas map', () => {
    expect(ground.land.length).toBeGreaterThan(1000)
    expect(ground.rivers.length).toBeGreaterThan(0)
  })

  it('centres the place, and stays inside the map at its edges', () => {
    const middle = shareMapWindow(2300, 1200)
    expect(shareMapPixel(middle, 2300, 1200)).toEqual({
      left: SHARE_MAP_SIZE / 2,
      top: SHARE_MAP_SIZE / 2,
    })
    const corner = shareMapWindow(10, 10)
    expect(corner.left).toBe(0)
    expect(corner.top).toBe(0)
  })

  it('draws the place and its neighbours', () => {
    const svg = shareMapSvg(ground, { x: 2300, y: 1200, neighbours: [['Jérusalem', 2302, 1240]] })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.match(/<circle/gu)).toHaveLength(3)
  })

  it('is signed into the address of the card like any card', () => {
    const content: ShareCardContent = {
      kind: 'entity',
      kicker: 'Atlas de la Bible',
      chip: 'Lieux',
      title: 'Béthel',
      map: { x: 2300, y: 1200, neighbours: [['Aï', 2305, 1203]] },
    }
    expect(readSignedShareCard(signShareCard(content, 'secret'), 'secret')).toEqual(content)
  })
})
