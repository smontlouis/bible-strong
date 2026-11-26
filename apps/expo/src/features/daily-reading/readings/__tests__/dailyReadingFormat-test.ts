import {
  getDailyCollectionUri,
  getDailyEntryKey,
  getDailySceneUri,
  getReserveEntryKey,
  getVerseMeditationsId,
  parseDailyCatalog,
  parseDailyCollection,
} from '../dailyReadingFormat'

const entry = (scene: string) => ({
  scene,
  ref: 'MAT.5.6',
  label: 'Matthieu 5.6',
  theme: 'justice',
  cards: [
    { type: 'verse', text: 'Heureux ceux qui ont faim…', label: 'Matthieu 5.6' },
    { type: 'hook', text: 'Une faim qui sera comblée.' },
    {
      type: 'part',
      title: 'Une faim',
      text: 'Jésus parle…',
      strong: { word: 'rassasiés', code: 'G5526', translit: 'chortazō' },
    },
    { type: 'part', title: 'Garder faim', text: 'Vous voyez…', strong: { word: 3 } },
    { type: 'prayer', text: 'Seigneur…' },
    { type: 'questions', items: ['Qu’évoquent…', 4, 'Que découvrez-vous…'] },
    { type: 'later-card', text: 'Unknown' },
  ],
})

const collection = {
  format: 'bible-strong-daily-readings',
  version: 1,
  id: 'verse-meditations-fr',
  kind: 'verse-meditations',
  language: 'fr',
  calendar: { '01-01': '7', '02-29': '8', '13-01': '7', '03-01': 'missing' },
  reserve: ['9', '10', '11', 'missing'],
  entries: {
    '7': entry('champ-a'),
    '8': entry('lac-b'),
    '9': entry('a'),
    '10': entry('b'),
    '11': entry('c'),
    broken: { cards: [] },
  },
}

describe('parseDailyCatalog', () => {
  it('keeps the well-formed collections and scenes', () => {
    const catalog = parseDailyCatalog({
      format: 'bible-strong-daily-readings-catalog',
      version: 1,
      generatedAt: '2026-11-26T00:00:00.000Z',
      collections: {
        'verse-meditations-fr': {
          hash: '5779204b2fa5',
          language: 'fr',
          kind: 'verse-meditations',
          bytes: 10,
          days: 366,
        },
        bad: { hash: 'nope', language: 'fr', kind: 'verse-meditations' },
      },
      scenes: {
        'champ-a': { hash: '0123456789ab', widths: [1254, 768] },
        empty: { hash: '0123456789ab', widths: [] },
      },
    })
    expect(Object.keys(catalog!.collections)).toEqual(['verse-meditations-fr'])
    expect(catalog!.scenes).toEqual({ 'champ-a': { hash: '0123456789ab', widths: [768, 1254] } })
  })

  it('refuses another document', () => {
    expect(parseDailyCatalog({ version: 1, collections: {}, scenes: {} })).toBeUndefined()
  })
})

describe('parseDailyCollection', () => {
  const parsed = parseDailyCollection(collection, 'verse-meditations-fr')!

  it('keeps the entries, cards and days it can read', () => {
    expect(Object.keys(parsed.entries).sort()).toEqual(['10', '11', '7', '8', '9'])
    expect(parsed.calendar).toEqual({ '01-01': '7', '02-29': '8' })
    expect(parsed.reserve).toEqual(['9', '10', '11'])
    const cards = parsed.entries['7'].cards
    expect(cards.map(card => card.type)).toEqual([
      'verse',
      'hook',
      'part',
      'part',
      'prayer',
      'questions',
    ])
    expect(cards[3]).toEqual({ type: 'part', title: 'Garder faim', text: 'Vous voyez…' })
    expect(cards[5]).toEqual({ type: 'questions', items: ['Qu’évoquent…', 'Que découvrez-vous…'] })
  })

  it('refuses the file of another collection', () => {
    expect(parseDailyCollection(collection, 'verse-meditations-en')).toBeUndefined()
  })

  it('finds the entry of a date', () => {
    expect(getDailyEntryKey(parsed, '2027-01-01')).toBe('7')
    expect(getDailyEntryKey(parsed, '2028-02-29')).toBe('8')
    expect(getDailyEntryKey(parsed, '2027-03-01')).toBeUndefined()
  })

  it('offers each verse of the reserve once a day', () => {
    const first = getReserveEntryKey(parsed, '2027-01-01', ['7'])!
    const second = getReserveEntryKey(parsed, '2027-01-01', ['7', first])!
    const third = getReserveEntryKey(parsed, '2027-01-01', ['7', first, second])!
    expect(new Set([first, second, third])).toEqual(new Set(['9', '10', '11']))
    expect(getReserveEntryKey(parsed, '2027-01-01', ['7', first, second, third])).toBeUndefined()
  })
})

describe('addresses', () => {
  it('addresses a collection under its hash', () => {
    expect(getDailyCollectionUri('365j', '2813d1482d71')).toBe(
      'https://media.bible-strong.app/daily-readings/365j/2813d1482d71.json'
    )
  })

  it('takes the smallest width of a scene that covers the screen', () => {
    const scene = { hash: '0123456789ab', widths: [768, 1254] }
    expect(getDailySceneUri('champ-a', scene, 'bg', 600)).toBe(
      'https://media.bible-strong.app/daily-scenes/champ-a/0123456789ab/bg-w768.webp'
    )
    expect(getDailySceneUri('champ-a', scene, 'fg', 2000)).toBe(
      'https://media.bible-strong.app/daily-scenes/champ-a/0123456789ab/fg-w1254.webp'
    )
  })

  it('reads French meditations in French and English ones elsewhere', () => {
    expect(getVerseMeditationsId('fr-FR')).toBe('verse-meditations-fr')
    expect(getVerseMeditationsId('en')).toBe('verse-meditations-en')
    expect(getVerseMeditationsId('es')).toBe('verse-meditations-en')
  })
})
