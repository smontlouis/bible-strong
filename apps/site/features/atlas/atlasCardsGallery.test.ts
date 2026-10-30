import { describe, expect, it } from 'vitest'
import type { AtlasGalleryCard } from './atlasCardCatalog'
import {
  cardPacks,
  cardsByEra,
  drawPack,
  filterCards,
  NO_FILTERS,
  PACK_SIZE,
  readCardFilters,
  writeCardFilters,
} from './atlasCardsGallery'

const card = (
  id: string,
  name: string,
  extra: Partial<AtlasGalleryCard> = {}
): AtlasGalleryCard => ({
  id,
  entity: id.split('~')[0],
  family: 'human',
  stages: false,
  finish: 'glitter',
  fadeTop: false,
  scene: false,
  picture: `https://media.test/${id}/w768.webp`,
  original: '',
  script: 'he',
  transliteration: '',
  strong: 'H1',
  name,
  title: '',
  typeLine: '',
  foot: '',
  chapterCount: 1,
  meaning: '',
  brief: '',
  firstMention: '',
  chaptersLabel: '',
  paraphrase: false,
  sentence: '',
  source: '',
  era: 'Patriarches',
  eraRank: 1,
  roles: [],
  strongs: [],
  seriesIds: [],
  order: 0,
  ...extra,
})

const gallery = [
  card('Abraham@Gen.11.26-1Pe', 'Abraham', {
    original: 'אַבְרָהָם',
    transliteration: 'avraham',
    strong: 'H85',
    strongs: [{ code: 'H85', original: 'אַבְרָהָם', script: 'he' }],
    chapterCount: 120,
    roles: ['Patriarche'],
    order: 1,
  }),
  card('Moses@Exo.2.10-Rev', 'Moïse', {
    strong: 'H4872',
    strongs: [{ code: 'H4872', original: 'מֹשֶׁה', script: 'he' }],
    chapterCount: 700,
    era: 'Exode',
    eraRank: 2,
    roles: ['Prophète'],
    order: 3,
  }),
  card('David@Rut.4.17-Rev~roi', 'David', {
    stages: true,
    stage: 'roi',
    strong: 'H1732',
    strongs: [
      { code: 'H1732', original: 'דָּוִד', script: 'he' },
      { code: 'G1138', original: 'Δαυείδ', script: 'grc' },
    ],
    chapterCount: 900,
    era: 'Juges et royauté',
    eraRank: 3,
    seriesIds: ['kings'],
    order: 5,
  }),
  card('Baal@Num.22.41-Rom', 'Baal', {
    family: 'idol',
    era: 'Dieux et idoles',
    eraRank: 8,
    order: 9,
  }),
]

describe('the gallery of cards', () => {
  it('finds a card by its name without accents, its Hebrew without points or its Strong number', () => {
    const ids = (query: string) =>
      filterCards(gallery, { ...NO_FILTERS, query }).map(item => item.name)
    expect(ids('moise')).toEqual(['Moïse'])
    expect(ids('אברהם')).toEqual(['Abraham'])
    expect(ids('1732')).toEqual(['David'])
    // Every number of a character finds it, its Greek name too.
    expect(ids('G1138')).toEqual(['David'])
    expect(ids('Δαυειδ')).toEqual(['David'])
    expect(ids('h85')).toEqual(['Abraham'])
    expect(ids('prophète')).toEqual(['Moïse'])
    // A word is found at the start of a word only.
    expect(ids('oise')).toEqual([])
  })

  it('filters by family, era, series, role and life stages, and sorts', () => {
    const names = (filters: Partial<typeof NO_FILTERS>) =>
      filterCards(gallery, { ...NO_FILTERS, ...filters }).map(item => item.name)
    expect(names({ family: 'idol' })).toEqual(['Baal'])
    expect(names({ era: 2 })).toEqual(['Moïse'])
    expect(names({ series: 'kings' })).toEqual(['David'])
    expect(names({ role: 'Patriarche' })).toEqual(['Abraham'])
    expect(names({ stages: true })).toEqual(['David'])
    expect(names({ sort: 'name' })).toEqual(['Abraham', 'Baal', 'David', 'Moïse'])
    expect(names({ sort: 'named' })).toEqual(['David', 'Moïse', 'Abraham', 'Baal'])
  })

  it('groups the cards by era, in the order of the story', () => {
    expect(cardsByEra([...gallery].reverse()).map(group => group.era)).toEqual([
      'Patriarches',
      'Exode',
      'Juges et royauté',
      'Dieux et idoles',
    ])
  })

  it('writes the filters in the fragment of the address and reads them back', () => {
    const filters = {
      ...NO_FILTERS,
      query: 'roi',
      family: 'human' as const,
      era: 3,
      series: 'kings',
      stages: true,
      sort: 'named' as const,
    }
    const fragment = writeCardFilters(filters)
    expect(fragment.startsWith('#')).toBe(true)
    expect(readCardFilters(fragment)).toEqual(filters)
    expect(writeCardFilters(NO_FILTERS)).toBe('')
    expect(readCardFilters('#family=dragon&sort=random&era=-2')).toEqual(NO_FILTERS)
  })
})

describe('packs of cards', () => {
  const many = Array.from({ length: 30 }, (_, index) =>
    card(`P${index}@Gen.1.${index + 1}-Rev`, `P${index}`, {
      chapterCount: index + 1,
      eraRank: index % 2,
      era: index % 2 ? 'Patriarches' : 'Origines',
      order: index,
    })
  )
  // A stage of the best known character, so that one pack never holds a character twice.
  const pool = [...many, card('P29@Gen.1.30-Rev~old', 'P29 old', { chapterCount: 30, order: 30 })]

  it('draws five characters, two of the better known and three of the others', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let round = 0; round < 20; round += 1) {
      const drawn = drawPack(pool, new Set(), random)
      expect(drawn).toHaveLength(PACK_SIZE)
      expect(new Set(drawn.map(item => item.entity)).size).toBe(PACK_SIZE)
      expect(drawn.filter(item => item.chapterCount >= 16)).toHaveLength(2)
    }
  })

  it('draws cards not seen yet while the pack has enough of them', () => {
    const seen = new Set(pool.slice(0, 24).map(item => item.id))
    const drawn = drawPack(pool, seen)
    expect(drawn.every(item => !seen.has(item.id))).toBe(true)
    // With fewer than five characters left, every card can come again.
    expect(drawPack(pool, new Set(pool.slice(0, 29).map(item => item.id)))).toHaveLength(PACK_SIZE)
  })

  it('offers a pack of every card and one per era holding five characters', () => {
    const packs = cardPacks([...many, ...gallery.slice(0, 1)], 'Toute la Bible')
    expect(packs.map(pack => [pack.id, pack.count])).toEqual([
      ['all', 31],
      ['era-0', 15],
      ['era-1', 16],
    ])
    expect(packs[0].cover).toHaveLength(3)
  })
})
