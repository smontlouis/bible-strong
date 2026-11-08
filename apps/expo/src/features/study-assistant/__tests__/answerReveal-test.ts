import { AnswerReveal, advanceReveal, answerPace, startCursor } from '../answerReveal'
import type { Conversation, LocalMessage } from '../conversations'
import { WIDGET_LINK_PREFIX } from '../widgetSegments'

const pace = { ...answerPace, charactersPerSecond: 10, backlogSpeedup: 0 }
const card = (title: string, id: string) => `[${title}](${WIDGET_LINK_PREFIX}${id})`
const none = new Set<string>()

it('shows whole words at the pace, never part of one', () => {
  const answer = { text: 'Un deux trois quatre', widgetIds: none, streaming: false }
  let cursor = advanceReveal(startCursor, answer, 0, 400, pace)
  // 4 characters allowed: « Un » fits, « deux » with its space does not yet.
  expect(answer.text.slice(0, cursor.index)).toBe('Un')
  cursor = advanceReveal(cursor, answer, 400, 400, pace)
  expect(answer.text.slice(0, cursor.index)).toBe('Un deux')
  cursor = advanceReveal(cursor, answer, 800, 5000, pace)
  expect(cursor.index).toBe(answer.text.length)
})

it('reads a link by its words, not by its address', () => {
  const text = 'Voir [Jean 3:16](https://bible-strong.app/assistant-passage/John.3.16) ici'
  const cursor = advanceReveal(
    startCursor,
    { text, widgetIds: none, streaming: false },
    0,
    2000,
    pace
  )
  expect(cursor.index).toBe(text.length)
})

it('shows a card link at once, then waits for the card to come in', () => {
  const text = `Paul écrit :\n\n${card('Philippiens 4:6', 'w4')}\n\nLa suite.`
  const answer = { text, widgetIds: new Set(['w4']), streaming: false }
  let cursor = advanceReveal(startCursor, answer, 0, 2000, pace)
  expect(text.slice(0, cursor.index)).toBe(`Paul écrit :\n\n${card('Philippiens 4:6', 'w4')}`)
  expect(cursor.pausedUntil).toBe(answerPace.widgetPauseMs)
  // Nothing moves during the pause, whatever time is allowed.
  expect(advanceReveal(cursor, answer, 100, 5000, pace)).toBe(cursor)
  cursor = advanceReveal(cursor, answer, answerPace.widgetPauseMs, 2000, pace)
  expect(cursor.index).toBe(text.length)
})

it('holds a link that may still become a card, and a word still arriving', () => {
  const widgetIds = new Set(['w1'])
  const half = 'Voici le passage :\n\n[Philippiens 4:6](https://bible-strong.app/assist'
  const held = advanceReveal(startCursor, { text: half, widgetIds, streaming: true }, 0, 9000, pace)
  expect(half.slice(0, held.index)).toBe('Voici le passage :')
  const word = advanceReveal(
    startCursor,
    { text: 'Une réponse en cou', widgetIds, streaming: true },
    0,
    9000,
    pace
  )
  expect('Une réponse en cou'.slice(0, word.index)).toBe('Une réponse en')
  // Once the stream is over, an ordinary link and the last word show.
  const link = 'Voir [la source](https://example.org/page'
  expect(
    advanceReveal(startCursor, { text: link, widgetIds, streaming: false }, 0, 9000, pace).index
  ).toBe(link.length)
})

it('closes on trailing spaces once the answer is complete', () => {
  const text = 'Fin.\n\n'
  expect(
    advanceReveal(startCursor, { text, widgetIds: none, streaming: false }, 0, 1000, pace).index
  ).toBe(text.length)
})

const conversation = (text: string, state: LocalMessage['state']): Conversation => ({
  id: 'c',
  title: 'Question',
  updatedAt: 0,
  messages: [
    { id: 'q', role: 'user', text: 'Question ?', state: 'complete', createdAt: 0 },
    { id: 'a', role: 'assistant', text, state, createdAt: 0 },
  ],
})

describe('AnswerReveal', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const setup = () => {
    const shown: Conversation[] = []
    const active: boolean[] = []
    const reveal = new AnswerReveal(
      value => shown.push(value),
      value => active.push(value),
      pace
    )
    const last = () => shown.at(-1)!.messages.at(-1)!
    return { reveal, shown, active, last }
  }

  it('reveals a complete answer at the pace and only then shows it complete', () => {
    const { reveal, active, last } = setup()
    reveal.receive(conversation('', 'streaming'))
    reveal.receive(conversation('Une réponse assez longue.', 'complete'))
    expect(last()).toMatchObject({ text: '', state: 'streaming' })
    jest.advanceTimersByTime(1000)
    expect(last().state).toBe('streaming')
    expect(last().text.length).toBeGreaterThan(0)
    expect(last().text.length).toBeLessThan(25)
    jest.advanceTimersByTime(5000)
    expect(last()).toMatchObject({ text: 'Une réponse assez longue.', state: 'complete' })
    expect(active).toEqual([true, false])
    expect(reveal.active).toBe(false)
  })

  it('shows everything received when the reader stops, and what follows as it comes', () => {
    const { reveal, last } = setup()
    reveal.receive(conversation('Une réponse en cours', 'streaming'))
    reveal.flush()
    expect(last()).toMatchObject({ text: 'Une réponse en cours', state: 'streaming' })
    reveal.receive(conversation('Une réponse en cours, interrompue', 'interrupted'))
    expect(last()).toMatchObject({
      text: 'Une réponse en cours, interrompue',
      state: 'interrupted',
    })
    expect(reveal.active).toBe(false)
  })

  it('shows an error at once with what was received', () => {
    const { reveal, last } = setup()
    reveal.receive(conversation('Début', 'streaming'))
    reveal.receive(conversation('Début de réponse', 'error'))
    expect(last()).toMatchObject({ text: 'Début de réponse', state: 'error' })
  })

  it('goes back when the stream starts its answer again', () => {
    const { reveal, last } = setup()
    reveal.receive(conversation('Première version de la réponse.', 'streaming'))
    jest.advanceTimersByTime(3000)
    expect(last().text.startsWith('Première')).toBe(true)
    reveal.receive(conversation('', 'streaming'))
    expect(last().text).toBe('')
    reveal.receive(conversation('Seconde.', 'complete'))
    jest.advanceTimersByTime(5000)
    expect(last()).toMatchObject({ text: 'Seconde.', state: 'complete' })
  })

  it('shows answers as they arrive with reduced motion', () => {
    const { reveal, last } = setup()
    reveal.setInstant(true)
    reveal.receive(conversation('Tout de suite', 'streaming'))
    expect(last().text).toBe('Tout de suite')
  })
})
