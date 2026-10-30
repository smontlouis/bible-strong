import { describe, expect, it } from 'vitest'
import type { AtlasMapPoint } from './atlas.functions'
import type { AtlasGalleryCard } from './atlasCardCatalog'
import { afterName, buildAtlasCardHead, cut, shareMapNeighbours } from './atlasHead'
import { entitySharePicture } from './atlasPortraits'

describe('Head of an atlas page', () => {
  it('drops the name a line opens on', () => {
    expect(afterName('Israël, le père des douze tribus', 'Israël')).toBe('Le père des douze tribus')
    expect(afterName('Moïse – le prophète', 'Moïse')).toBe('Le prophète')
    expect(afterName('Le berger de Bethléhem', 'David')).toBeUndefined()
    expect(afterName('Israélite de la tribu de Juda', 'Israël')).toBeUndefined()
  })

  it('cuts a description at a word, without an open parenthesis', () => {
    const text =
      "Israël, aussi connu sous le nom de Jacob, était le fils d'Isaac et de Rebecca. Il est né après son frère jumeau Ésaü (Gen. 25:24-26)."
    expect(cut(text, 125)).toBe(
      "Israël, aussi connu sous le nom de Jacob, était le fils d'Isaac et de Rebecca. Il est né après son frère jumeau Ésaü…"
    )
    expect(cut('Court.', 155)).toBe('Court.')
  })
})

describe('Share picture of an entity', () => {
  it('is the PNG copy of its portrait or of its clay figure', () => {
    expect(
      entitySharePicture(
        'https://media.bible-strong.app/entity-images/Israel%40Gen.25.26-Rev/c432ebf1c978/w768.webp'
      )
    ).toBe(
      'https://media.bible-strong.app/entity-images/Israel%40Gen.25.26-Rev/c432ebf1c978/w512.png'
    )
    expect(entitySharePicture('/atlas/clay/male-5.webp')).toBe('/atlas/clay/male-5.png')
  })
})

describe('Places named on the map of a card', () => {
  const point: AtlasMapPoint = ['Béthel', 'Bethel@Gen.12.8', 2300, 1200, 70]

  it('names the most named first, inside the map, none covering another', () => {
    const neighbours: AtlasMapPoint[] = [
      ['Aï', 'Ai@Jos.7.2', 2305, 1203, 10],
      ['Jérusalem', 'Jerusalem@Gen.14.18-Rev', 2302, 1240, 351],
      ['Jéricho', 'Jericho@Num.22.1', 2330, 1270, 50],
      ['Silo', 'Shiloh@Jos.18.1', 2310, 1170, 30],
      ['Loin', 'Far@Gen.1.1', 2600, 1200, 400],
    ]
    expect(shareMapNeighbours(point, neighbours, 'Béthel').map(([name]) => name)).toEqual([
      'Jérusalem',
      'Jéricho',
      'Silo',
    ])
  })

  it('keeps five names at most', () => {
    const many: AtlasMapPoint[] = Array.from({ length: 12 }, (_, index) => [
      `L${index}`,
      `L${index}@Gen.1.1`,
      2200 + (index % 3) * 60,
      1110 + Math.floor(index / 3) * 40,
      index,
    ])
    expect(shareMapNeighbours(point, many, 'Béthel').length).toBeLessThanOrEqual(5)
  })
})

describe('Head of a card', () => {
  const card = {
    id: 'Israel@Gen.25.26-Rev~vieux',
    entity: 'Israel@Gen.25.26-Rev',
    family: 'human',
    name: 'Jacob',
    title: 'La bénédiction des douze fils',
    picture:
      'https://media.bible-strong.app/entity-images/Israel%40Gen.25.26-Rev/0123456789ab/w768.webp',
    sentence: 'Assemblez-vous, et je vous annoncerai ce qui vous arrivera.',
    source: 'Gn 49.1',
    brief: 'Patriarche, fils d’Isaac.',
  } as AtlasGalleryCard
  const head = buildAtlasCardHead({ language: 'fr', card, incomplete: false })
  const meta = (key: string) =>
    (head.meta as { name?: string; property?: string; content?: string }[]).find(
      item => item.name === key || item.property === key
    )?.content

  it('is shared, not indexed: it only opens a card over the gallery', () => {
    expect(meta('robots')).toBe('noindex, follow')
    expect(head.meta[0]).toEqual({
      title: 'Jacob – La bénédiction des douze fils | Cartes de la Bible',
    })
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://bible-strong.app/atlas/fr/cards/Israel@Gen.25.26-Rev~vieux',
    })
  })

  it('says the sentence of the card, with its reference', () => {
    expect(meta('description')).toBe(
      'Jacob, La bénédiction des douze fils : « Assemblez-vous, et je vous annoncerai ce qui vous arrivera. » (Gn 49.1). Patriarche, fils d’Isaac.'
    )
  })
})
