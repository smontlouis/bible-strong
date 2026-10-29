import { describe, expect, it } from 'vitest'
import { atlasCardsOf, parseCardCatalog } from './atlasCardCatalog'
import type { AtlasPortraitCatalog } from './atlasPortraits'

const text = (name: string) => ({
  name,
  fullName: name,
  title: `${name} title`,
  chaptersLabel: '1 S 16–17',
  era: 'Juges et royauté',
  roles: [],
  series: ["Les rois d'Israël uni"],
  meaning: 'bien-aimé',
  firstMention: 'Ruth 4:17',
  brief: 'Roi',
  typeLine: 'Humain — Roi',
})

const card = (id: string, stage: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  entity: 'David@Rut.4.17-Rev',
  stage,
  family: 'human',
  era: 'Juges et royauté',
  scene: false,
  backdrop: 'paturages',
  fadeTop: true,
  stageIndex: 0,
  stageCount: 2,
  chapterCount: 259,
  strong: 'H1732',
  original: 'דָּוִד',
  script: 'he',
  transliteration: 'david',
  series: [{ rank: 2, total: 3 }],
  text: { fr: text('David'), en: text('David') },
  line: {
    kind: 'citation',
    text: { fr: 'Tu marches contre moi…', en: 'You come against me…' },
    ref: '1Sa.17.45',
    refEn: '1Sa.17.45',
    reference: { fr: '1 S 17.45', en: '1 Sam 17:45' },
    speaker: null,
    source: { fr: '1 S 17.45', en: '1 Sam 17:45' },
  },
  ...extra,
})

const portraits: AtlasPortraitCatalog = {
  entities: {
    'David@Rut.4.17-Rev': {
      hash: 'aaaaaaaa',
      roles: [],
      stages: [
        { key: 'roi', label: { fr: 'Le roi', en: 'The king' }, hash: 'bbbbbbbb', ranges: [] },
      ],
    },
  },
  series: [],
  roles: {},
}

describe('atlas cards', () => {
  const catalog = parseCardCatalog({
    version: 1,
    cards: [
      card('David@Rut.4.17-Rev', null),
      card('David@Rut.4.17-Rev~roi', 'roi', { line: { kind: 'paraphrase' } }),
      card('David@Rut.4.17-Rev~absent', 'absent'),
      { id: 'broken' },
    ],
    backdrops: { paturages: { hash: 'cccccccc' } },
  })

  it('keeps the well-formed cards of a published catalog', () => {
    expect(catalog?.cards.map(item => item.id)).toEqual([
      'David@Rut.4.17-Rev',
      'David@Rut.4.17-Rev~absent',
    ])
    expect(parseCardCatalog({ version: 2, cards: [] })).toBeUndefined()
  })

  it('gives each card its portrait, its backdrop and its finish', () => {
    const cards = atlasCardsOf(
      'David@Rut.4.17-Rev',
      catalog!,
      portraits,
      'fr',
      'https://example.test'
    )
    // A stage the portraits do not have has no picture: its card is left out.
    expect(cards.map(item => item.id)).toEqual(['David@Rut.4.17-Rev'])
    expect(cards[0]).toMatchObject({
      picture:
        'https://media.bible-strong.app/entity-images/David%40Rut.4.17-Rev/aaaaaaaa/w768.webp',
      backdrop: 'https://example.test/backdrops/paturages/cccccccc/w768.webp',
      finish: 'v',
      stages: true,
      foot: "Les rois d'Israël uni",
      sentence: 'Tu marches contre moi…',
    })
  })
})
