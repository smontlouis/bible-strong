jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'fr' } }) }))
jest.mock('../useDailyReadings', () => ({ useDailyEntry: jest.fn() }))
jest.mock('../useVerseSwap', () => ({ useVerseSwap: jest.fn() }))

import { parseStudySurfaceContext } from '@bible-strong/ai-contract/contract'
import type { DailyEntry } from '../dailyReadingFormat'
import { meditationReadingContext } from '../meditationContext'

const entry: DailyEntry = {
  scene: 'path',
  ref: 'ISA.30.21',
  label: 'Ésaïe 30:21',
  cards: [
    { type: 'verse', text: 'Tes oreilles entendront derrière toi la voix…', label: 'Ésaïe 30:21' },
    { type: 'hook', text: 'Une voix qui suit le marcheur.' },
    {
      type: 'part',
      title: 'La voix derrière',
      text: 'Le prophète…',
      strong: { word: 'parole', code: 'H1697', translit: 'dabar' },
    },
    { type: 'part', title: 'Le chemin', text: 'Marchez-y.' },
    { type: 'prayer', text: 'Seigneur, guide-moi.' },
    { type: 'questions', items: ['Que remarquez-vous ?', 'Où déviez-vous ?'] },
  ],
}

const build = (overrides: Partial<Parameters<typeof meditationReadingContext>[0]> = {}) =>
  meditationReadingContext({
    collection: { id: 'verse-meditations-fr', language: 'fr' },
    entryKey: '1347',
    entry,
    question: 'Que remarquez-vous ?',
    version: 'LSG',
    label: 'Méditation · Ésaïe 30:21',
    ...overrides,
  })

it('pins the meditation and Strobi’s question, as the Worker reads them', () => {
  const context = build()!
  expect(context).toMatchObject({
    kind: 'meditation',
    label: 'Méditation · Ésaïe 30:21',
    bibleVersion: 'LSG',
    opening: 'Que remarquez-vous ?',
    activeContext: {
      kind: 'meditation',
      resourceId: 'verse-meditations-fr',
      sectionId: '1347',
      language: 'fr',
      reference: 'Ésaïe 30:21',
      book: 23,
      chapter: 30,
      startVerse: 21,
      endVerse: 21,
    },
  })
  expect(context.detail).toBe(
    'Méditation du verset de Bible Strong : Ésaïe 30:21. Ressource=verse-meditations-fr; entrée=1347; langue=fr'
  )
  expect(context.content?.split('\n')).toEqual([
    'Question d’ouverture posée au lecteur par Strobi : Que remarquez-vous ?',
    '',
    'Verset (LSG) : Tes oreilles entendront derrière toi la voix… — Ésaïe 30:21',
    'Accroche : Une voix qui suit le marcheur.',
    'La voix derrière : Le prophète… (mot dabar, H1697, « parole »)',
    'Le chemin : Marchez-y.',
    'Prière : Seigneur, guide-moi.',
    'Questions de la méditation : Que remarquez-vous ? / Où déviez-vous ?',
  ])
  expect(parseStudySurfaceContext(context.activeContext)).toEqual(context.activeContext)
})

it('writes the lines in English for the English meditations, and stays within the limits', () => {
  const context = build({
    collection: { id: 'verse-meditations-en', language: 'en' },
    version: 'BSB',
    question: 'Q'.repeat(900),
  })!
  expect(context.content).toMatch(/^Opening question Strobi asked the reader : Q/)
  expect(context.content).toContain('\nVerse (BSB) : ')
  expect(context.opening).toHaveLength(500)
  expect(context.content!.length).toBeLessThanOrEqual(12000)
  expect(context.activeContext?.language).toBe('en')
})

it('needs the verse, and leaves the passage out of a reference it cannot read', () => {
  expect(build({ entry: { ...entry, cards: entry.cards.slice(1) } })).toBeNull()
  const context = build({ entry: { ...entry, ref: 'XYZ.1.1' } })!
  expect(context.activeContext).not.toHaveProperty('book')
})
