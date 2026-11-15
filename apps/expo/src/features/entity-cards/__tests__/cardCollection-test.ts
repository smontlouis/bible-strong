import type { CardCatalog, PublishedCard } from '../cardCatalog'
import {
  getCardAlbum,
  getLatestCollected,
  getMeetingBook,
  sortCardsByBible,
} from '../cardCollection'

const text = (era: string, firstMention: string) => ({
  name: '',
  title: '',
  chaptersLabel: '',
  series: [],
  meaning: '',
  firstMention,
  brief: '',
  typeLine: '',
  era,
})

const card = (
  id: string,
  era: string,
  firstMention: string,
  extra: Partial<PublishedCard> = {}
): PublishedCard =>
  ({
    id,
    entity: id.split('~')[0],
    stage: id.includes('~') ? id.split('~')[1] : null,
    family: 'human',
    era,
    scene: false,
    backdrop: null,
    fadeTop: false,
    stageCount: 1,
    chapterCount: 1,
    strong: '',
    original: '',
    script: 'he',
    transliteration: '',
    text: { fr: text(era, firstMention), en: text(era, firstMention) },
    line: { kind: 'verset', text: { fr: '', en: '' }, source: { fr: '', en: '' } },
    ...extra,
  }) as PublishedCard

const catalog: CardCatalog = {
  backdrops: {},
  cards: [
    card('Moses@Exo.2.10-Rev', 'Exode', 'Exode 2:10'),
    card('Abraham@Gen.11.26-1Pe~abram', 'Patriarches', 'Genèse 11:26', { stageIndex: 1 }),
    card('Abraham@Gen.11.26-1Pe', 'Patriarches', 'Genèse 11:26'),
    card('Adam@Gen.2.19-Jud', 'Origines', 'Genèse 2:19'),
    card('LORD@Gen.1.1-Rev', 'Êtres spirituels', 'Genèse 1:1', { family: 'divine' }),
    card('Baal@Num.25.3-Rom', 'Dieux et idoles', '2 Rois 1:2', { family: 'idol' }),
  ],
}

describe('the card album', () => {
  it('orders the cards as the Bible meets them, stages after their character', () => {
    expect(sortCardsByBible(catalog.cards).map(item => item.id)).toEqual([
      'LORD@Gen.1.1-Rev',
      'Adam@Gen.2.19-Jud',
      'Abraham@Gen.11.26-1Pe',
      'Abraham@Gen.11.26-1Pe~abram',
      'Moses@Exo.2.10-Rev',
      'Baal@Num.25.3-Rom',
    ])
  })

  it('opens on God, then the eras of the story, and counts what is collected', () => {
    const album = getCardAlbum(catalog, { 'Adam@Gen.2.19-Jud': 5 }, 'fr')
    expect(album.eras.map(era => [era.title, era.found, era.total])).toEqual([
      ['Dieu', 1, 1],
      ['Origines', 1, 1],
      ['Patriarches', 0, 2],
      ['Exode', 0, 1],
      ['Dieux et idoles', 0, 1],
    ])
    expect(album.characters).toEqual({ found: 2, total: 5 })
    expect(album.stages).toEqual({ found: 0, total: 1 })
    expect([album.found, album.total]).toEqual([2, 6])
  })

  it('keeps only the cards a filter asks for', () => {
    const found = getCardAlbum(catalog, { 'Adam@Gen.2.19-Jud': 5 }, 'fr', { filter: 'found' })
    expect(found.eras.flatMap(era => era.cards.map(item => item.id))).toEqual([
      'LORD@Gen.1.1-Rev',
      'Adam@Gen.2.19-Jud',
    ])
    const missing = getCardAlbum(catalog, { 'Adam@Gen.2.19-Jud': 5 }, 'fr', { filter: 'missing' })
    expect(missing.eras.map(era => era.key)).toEqual(['Patriarches', 'Exode', 'Dieux et idoles'])
  })

  it('sorts the found cards newest first, God last, then those still to find', () => {
    const album = getCardAlbum(catalog, { 'Adam@Gen.2.19-Jud': 5, 'Moses@Exo.2.10-Rev': 9 }, 'fr', {
      order: 'recent',
    })
    expect(album.eras.map(era => [era.key, era.cards.map(item => item.id)])).toEqual([
      ['found', ['Moses@Exo.2.10-Rev', 'Adam@Gen.2.19-Jud', 'LORD@Gen.1.1-Rev']],
      ['missing', ['Abraham@Gen.11.26-1Pe', 'Abraham@Gen.11.26-1Pe~abram', 'Baal@Num.25.3-Rom']],
    ])
  })

  it('names the book where a character is met, and the last cards collected', () => {
    expect(getMeetingBook(catalog.cards[5], 'fr')).toBe('2 Rois')
    expect(getMeetingBook(catalog.cards[3], 'fr')).toBe('Genèse')
    expect(
      getLatestCollected(catalog, { 'Adam@Gen.2.19-Jud': 5, 'Moses@Exo.2.10-Rev': 9 }, 3).map(
        item => item.id
      )
    ).toEqual(['Moses@Exo.2.10-Rev', 'Adam@Gen.2.19-Jud'])
  })
})
