import {
  formatEntityChapterRanges,
  getEntitySeriesPlace,
  getEntityPlaceholderIndex,
  getEntityChapterPortraitHash,
  getEntityPortraitGround,
  getEntityPortraitPictures,
  getEntityPortraitText,
  planEntityPortraitPack,
  getEntityPortraitUri,
  parseEntityPortraitCatalog,
} from '../entityPortraits'

describe('entity portraits', () => {
  it('addresses a portrait by its unique name and hash', () => {
    expect(getEntityPortraitUri("King's_Highway@Num.20.17-", '0123456789ab')).toBe(
      "https://media.bible-strong.app/entity-images/King's_Highway%40Num.20.17-/0123456789ab/w256.webp"
    )
    expect(getEntityPortraitUri('Paul@Act.7.58-2Pe', 'abcdef', 'w768')).toMatch(
      /\/abcdef\/w768\.webp$/
    )
  })

  it('draws the dusk blue behind a portrait in a dark theme, the light primary in a light one', () => {
    const dark = { primary: 'rgb(14, 211, 185)', lightPrimary: 'rgba(14, 211, 185, 0.5)' }
    expect(getEntityPortraitGround(true, dark)).toMatch(/^radial-gradient\(.*#2e466a/)
    expect(getEntityPortraitGround(true, dark)).not.toContain('14, 211')
    // The centre leans towards the primary blue, the edge keeps the light primary.
    expect(
      getEntityPortraitGround(false, {
        primary: 'rgb(89,131,240)',
        lightPrimary: 'rgb(233, 243, 252)',
      })
    ).toBe('radial-gradient(circle at 50% 35%, rgb(201, 218, 249) 0%, rgb(233, 243, 252) 75%)')
  })

  it('keeps the well-formed entries of a catalog', () => {
    const catalog = parseEntityPortraitCatalog({
      version: 3,
      entities: {
        'Paul@Act.7.58-2Pe': {
          hash: '0123456789ab',
          title: { fr: "L'apôtre des nations", en: 'The apostle to the Gentiles' },
          stagesLabel: 'Étapes',
          roles: ['apotre', 3],
          stages: [
            {
              key: 'saul',
              label: { fr: 'Saul le persécuteur', en: 'Saul the persecutor' },
              hash: 'abcdef12',
              ranges: [{ book: 44, from: 7, to: 9 }],
            },
            {
              key: 'bad',
              label: { fr: 'Sans plage', en: 'No range' },
              hash: 'abcdef34',
              ranges: [],
            },
            {
              key: 'french',
              label: { fr: 'Sans anglais' },
              hash: 'abcdef56',
              ranges: [{ book: 44, from: 10, to: 10 }],
            },
          ],
        },
        'Bad@Gen.1.1': { hash: '../x' },
        'Num@Gen.1.1': 3,
      },
      series: [
        {
          id: 'apotres',
          title: { fr: 'Les douze apôtres', en: 'The twelve apostles' },
          members: ['Peter@Mat.4.18-2Pe'],
        },
        { id: 'texte', title: 'Texte seul', members: [] },
        { id: 1 },
      ],
      roles: { apotre: { fr: 'Apôtre', en: 'Apostle' }, roi: 'Roi' },
    })
    expect(Object.keys(catalog?.entities ?? {})).toEqual(['Paul@Act.7.58-2Pe'])
    expect(catalog?.entities['Paul@Act.7.58-2Pe']).toEqual({
      hash: '0123456789ab',
      title: { fr: "L'apôtre des nations", en: 'The apostle to the Gentiles' },
      roles: ['apotre'],
      stages: [
        {
          key: 'saul',
          label: { fr: 'Saul le persécuteur', en: 'Saul the persecutor' },
          hash: 'abcdef12',
          ranges: [{ book: 44, from: 7, to: 9 }],
        },
      ],
    })
    expect(catalog?.series).toHaveLength(1)
    expect(Object.keys(catalog?.roles ?? {})).toEqual(['apotre'])
  })

  it('refuses what is not a catalog', () => {
    expect(parseEntityPortraitCatalog(null)).toBeUndefined()
    expect(parseEntityPortraitCatalog({ version: 1, portraits: {} })).toBeUndefined()
    expect(parseEntityPortraitCatalog({ version: 2, entities: {} })).toBeUndefined()
    expect(parseEntityPortraitCatalog('<html>')).toBeUndefined()
  })

  it('shows a text in French, and in English for every other language', () => {
    const text = { fr: 'Le crucifié', en: 'The crucified one' }
    expect(getEntityPortraitText(text, 'fr')).toBe('Le crucifié')
    expect(getEntityPortraitText(text, 'en')).toBe('The crucified one')
    expect(getEntityPortraitText(text, 'es')).toBe('The crucified one')
  })

  it('shows the stage that covers a chapter, the portrait elsewhere', () => {
    const naaman = {
      hash: 'aaaaaa',
      stages: [
        {
          key: 'gueri',
          label: { fr: 'Guéri', en: 'Healed' },
          hash: 'bbbbbb',
          ranges: [
            { book: 12, from: 5, to: 5, fromVerse: 14, toVerse: 19 },
            { book: 42, from: 4, to: 4 },
          ],
        },
      ],
    }
    expect(getEntityChapterPortraitHash(naaman, 12, 5)).toBe('aaaaaa')
    expect(getEntityChapterPortraitHash(naaman, 42, 4)).toBe('bbbbbb')
    expect(getEntityChapterPortraitHash(naaman, 42, 5)).toBe('aaaaaa')
    expect(getEntityChapterPortraitHash({ hash: 'cccccc' }, 1, 1)).toBe('cccccc')
  })

  it('picks the same placeholder for the same entity, and spreads entities over the five', () => {
    expect(getEntityPlaceholderIndex('Moses@Exo.2.10-Rev', 5)).toBe(
      getEntityPlaceholderIndex('Moses@Exo.2.10-Rev', 5)
    )
    const picked = new Set(
      Array.from({ length: 200 }, (_, index) =>
        getEntityPlaceholderIndex(`Entity${index}@Gen.1.1`, 5)
      )
    )
    expect([...picked].sort()).toEqual([0, 1, 2, 3, 4])
    expect(getEntityPlaceholderIndex('Moses@Exo.2.10-Rev', 1)).toBe(0)
  })

  it('lists every picture of the catalog once, stages included', () => {
    const catalog = parseEntityPortraitCatalog({
      version: 3,
      entities: {
        'David@Rut.4.17-Rev': {
          hash: 'aaaaaa',
          stages: [
            {
              key: 'roi',
              label: { fr: 'Le roi', en: 'The king' },
              hash: 'bbbbbb',
              ranges: [{ book: 10, from: 1, to: 24 }],
            },
          ],
        },
        'Bethlehem@Gen.35.16-Jhn': { hash: 'cccccc' },
        'Ephrath@Gen.35.16-Mic': { hash: 'cccccc' },
      },
    })
    expect(getEntityPortraitPictures(catalog!)).toEqual([
      { hash: 'aaaaaa', uniqueName: 'David@Rut.4.17-Rev' },
      { hash: 'bbbbbb', uniqueName: 'David@Rut.4.17-Rev' },
      { hash: 'cccccc', uniqueName: 'Bethlehem@Gen.35.16-Jhn' },
    ])
  })

  it('downloads what the catalog adds and deletes what it no longer names', () => {
    expect(planEntityPortraitPack(['a1', 'b2', 'c3'], ['b2', 'z9'])).toEqual({
      missing: ['a1', 'c3'],
      obsolete: ['z9'],
    })
    expect(planEntityPortraitPack([], [])).toEqual({ missing: [], obsolete: [] })
  })

  it('finds the place of an entity in its series', () => {
    const catalog = parseEntityPortraitCatalog({
      version: 3,
      entities: {},
      series: [
        {
          id: 'rois-unis',
          title: { fr: 'Les rois d’Israël uni', en: 'The kings of united Israel' },
          members: ['Saul@1Sa.9.2-Act', 'David@Rut.4.17-Rev', 'Solomon@2Sa.5.14-Act'],
        },
      ],
    })!
    expect(getEntitySeriesPlace(catalog, 'David@Rut.4.17-Rev')).toEqual({
      title: { fr: 'Les rois d’Israël uni', en: 'The kings of united Israel' },
      rank: 2,
      total: 3,
    })
    expect(getEntitySeriesPlace(catalog, 'Akisch@1Sa.21.10-Psa')).toBeUndefined()
  })

  it('writes the chapters of a stage as the reader reads them', () => {
    const names: Record<number, string> = { 9: '1 Samuel', 12: '2 Rois', 13: '1 Chroniques' }
    const name = (book: number) => names[book]
    expect(
      formatEntityChapterRanges(
        [
          { book: 9, from: 18, to: 31 },
          { book: 13, from: 11, to: 11 },
        ],
        name
      )
    ).toBe('1 Samuel 18–31 ; 1 Chroniques 11')
    expect(
      formatEntityChapterRanges([{ book: 12, from: 5, to: 5, fromVerse: 14, toVerse: 19 }], name)
    ).toBe('2 Rois 5:14–19')
  })
})
