import type { EntityPortraitCatalog } from '~features/lexique/entityPortraits'

import { getEntityCardView, parseCardCatalog } from '../cardCatalog'

const text = (name: string, title: string) => ({
  name,
  title,
  chaptersLabel: '',
  series: [],
  meaning: '',
  firstMention: 'Genèse 11:26',
  brief: 'Le père des croyants',
  typeLine: 'Humain — Patriarche',
})

const card = (id: string, extra: Record<string, unknown>) => ({
  id,
  entity: 'Abraham@Gen.11.26-1Pe',
  stage: null,
  family: 'human',
  scene: false,
  backdrop: 'nuit-etoilee',
  fadeTop: false,
  stageCount: 2,
  chapterCount: 82,
  strong: 'H0085',
  original: 'אַבְרָהָם',
  script: 'he',
  transliteration: 'avraham',
  text: { fr: text('Abraham', 'Le père des croyants'), en: text('Abraham', 'Father of faith') },
  line: {
    kind: 'citation',
    text: { fr: 'Dieu se pourvoira', en: 'God himself will provide' },
    source: { fr: 'Gn 22.8', en: 'Gen 22:8' },
  },
  ...extra,
})

const published = {
  version: 1,
  cards: [
    card('Abraham@Gen.11.26-1Pe~abram', { stage: 'abram', stageIndex: 1 }),
    card('Abraham@Gen.11.26-1Pe', { stageIndex: 0 }),
    card('Baal@Num.25.3-Rom', { entity: 'Baal@Num.25.3-Rom', family: 'idol', stageCount: 1 }),
    { id: 'not a card' },
  ],
  backdrops: { 'nuit-etoilee': { hash: '0123456789ab' } },
}

const portraits: EntityPortraitCatalog = {
  entities: {
    'Abraham@Gen.11.26-1Pe': {
      hash: 'aaaaaaaaaaaa',
      stages: [
        {
          key: 'abram',
          label: { fr: 'Abram', en: 'Abram' },
          hash: 'bbbbbbbbbbbb',
          ranges: [{ book: 1, from: 12, to: 16 }],
        },
      ],
    },
    'Baal@Num.25.3-Rom': { hash: 'cccccccccccc' },
  },
  series: [],
  roles: {},
}

describe('card catalog', () => {
  it('keeps the well-formed cards', () => {
    const catalog = parseCardCatalog(published)
    expect(catalog?.cards.map(entry => entry.id)).toEqual([
      'Abraham@Gen.11.26-1Pe~abram',
      'Abraham@Gen.11.26-1Pe',
      'Baal@Num.25.3-Rom',
    ])
    expect(catalog?.backdrops).toEqual({ 'nuit-etoilee': '0123456789ab' })
    expect(parseCardCatalog({ version: 2, cards: [] })).toBeUndefined()
  })

  it('reads the finish from the family and the life stages', () => {
    const catalog = parseCardCatalog(published)!
    const [abram, abraham, baal] = catalog.cards.map(entry =>
      getEntityCardView(entry, catalog, portraits, 'fr')
    )
    expect(abraham).toMatchObject({ stages: true, finish: 'v', rank: 1, total: 2 })
    expect(abram).toMatchObject({ finish: 'v', rank: 2, total: 2 })
    expect(baal).toMatchObject({ stages: false, finish: 'reverse', rank: 1, total: 1 })
  })

  it('takes the stage portrait and the backdrop of the card', () => {
    const catalog = parseCardCatalog(published)!
    const abram = getEntityCardView(catalog.cards[0], catalog, portraits, 'en')
    expect(abram?.picture).toContain('/bbbbbbbbbbbb/w768.webp')
    expect(abram?.backdrop).toBe(
      'https://media.bible-strong.app/entity-cards/backdrops/nuit-etoilee/0123456789ab/w768.webp'
    )
    expect(abram).toMatchObject({ title: 'Father of faith', source: 'Gen 22:8', language: 'en' })
  })

  it('draws no card whose portrait is not published', () => {
    const catalog = parseCardCatalog(published)!
    const lonely = { ...portraits, entities: {} }
    expect(getEntityCardView(catalog.cards[1], catalog, lonely, 'fr')).toBeUndefined()
  })
})
