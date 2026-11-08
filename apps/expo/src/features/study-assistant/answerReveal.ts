import type { Conversation, LocalMessage } from './conversations'
import { mayBecomeWidgetLink, widgetLinkAt } from './widgetSegments'

/**
 * How fast an answer is shown (2026-11-08). The model writes far faster than anyone reads, so
 * the answer is revealed word by word, whatever the network does: slowly while the reader
 * takes in its opening, then fast, since a long answer at reading pace kept them waiting a
 * minute. The received text stays whole: it is saved as soon as it is complete and only the
 * screen waits.
 */
export const answerPace = {
  /** Visible characters per second at the start. Silent reading runs at about 20–25. */
  slowCharactersPerSecond: 50,
  /** How long the start is written slowly, from its first word, card pauses left out. */
  slowStartMs: 3000,
  /** Time taken to go from the slow pace to the fast one. */
  rampMs: 1000,
  /** Visible characters per second afterwards: a long answer in about ten seconds. */
  fastCharactersPerSecond: 400,
  /** Time a card is given to come in before the text goes on, at each pace. */
  widgetPauseMs: { slow: 750, fast: 300 },
  /** Time a card takes to come in (`widgets/WidgetReveal`), at each pace. */
  widgetRevealMs: { slow: 700, fast: 350 },
  /** Interval of the reveal clock. */
  tickMs: 40,
}

export type AnswerPace = typeof answerPace

/** Characters per second once `writtenMs` of the answer have been written. */
export function paceAt(writtenMs: number, pace: AnswerPace = answerPace) {
  const ramp = Math.min(1, Math.max(0, (writtenMs - pace.slowStartMs) / pace.rampMs))
  const eased = ramp * ramp * (3 - 2 * ramp)
  return (
    pace.slowCharactersPerSecond +
    (pace.fastCharactersPerSecond - pace.slowCharactersPerSecond) * eased
  )
}

const isFast = (writtenMs: number, pace: AnswerPace) => writtenMs >= pace.slowStartMs

// The pace of the answer being revealed, for the card that comes in now. One answer is
// revealed at a time.
let revealingFast = false

/** How long a card placed now takes to come in. */
export const widgetRevealMs = () =>
  revealingFast ? answerPace.widgetRevealMs.fast : answerPace.widgetRevealMs.slow

export type RevealCursor = {
  /** Length of the text already shown. */
  index: number
  /** Characters the elapsed time allows, not spent yet. */
  budget: number
  /** Nothing moves before this time: a card is coming in. */
  pausedUntil: number
  /** Time spent writing since the first word, card pauses left out. */
  writtenMs: number
}

export const startCursor: RevealCursor = { index: 0, budget: 0, pausedUntil: 0, writtenMs: 0 }

const WORD = /\s*\S+/y

/** What a word costs on screen: a link's address is not read, so it is free. */
const visibleLength = (word: string) => word.replace(/\]\([^)\s]*\)?/g, '').length

/**
 * Moves the shown part of an answer forward by the time elapsed, a whole word at a time.
 * A card link is shown at once and followed by a pause while the card comes in; a link that
 * may still become one, or a word still being received, waits for the rest of the stream.
 */
export function advanceReveal(
  cursor: RevealCursor,
  answer: { text: string; widgetIds: ReadonlySet<string>; streaming: boolean },
  now: number,
  elapsedMs: number,
  pace: AnswerPace = answerPace
): RevealCursor {
  if (now < cursor.pausedUntil) return cursor
  const { text, widgetIds, streaming } = answer
  let { index, budget } = cursor
  const writtenMs = index > 0 ? cursor.writtenMs + elapsedMs : 0
  const rate = paceAt(writtenMs, pace)
  if (index >= text.length)
    return { index: Math.min(index, text.length), budget: 0, pausedUntil: 0, writtenMs }
  budget += (elapsedMs / 1000) * rate
  let held = false
  while (index < text.length) {
    WORD.lastIndex = index
    const match = WORD.exec(text)
    // Only spaces are left: they come with the next word, or close the answer.
    if (!match) {
      if (streaming) held = true
      else index = text.length
      break
    }
    let word = match[0]
    const start = index + word.length - word.trimStart().length
    if (text[start] === '[') {
      const link = widgetLinkAt(text, start)
      if (link && widgetIds.has(link.id)) {
        const pause = isFast(writtenMs, pace) ? pace.widgetPauseMs.fast : pace.widgetPauseMs.slow
        return { index: link.end, budget: 0, pausedUntil: now + pause, writtenMs }
      }
      if (!link && streaming && mayBecomeWidgetLink(text.slice(start))) {
        held = true
        break
      }
    } else {
      // A link glued to a word starts a word of its own, so a card is never shown in halves.
      const bracket = text.indexOf('[', start)
      if (bracket > -1 && bracket < index + word.length) word = text.slice(index, bracket)
    }
    if (streaming && index + word.length === text.length) {
      held = true
      break
    }
    const cost = visibleLength(word)
    if (cost > budget) break
    budget -= cost
    index += word.length
  }
  // Time spent waiting for the stream is not saved up: the next words would burst out.
  if (held || index >= text.length) budget = Math.min(budget, rate * 0.1)
  return { index, budget, pausedUntil: 0, writtenMs }
}

const commonPrefixLength = (a: string, b: string) => {
  let length = 0
  while (length < a.length && length < b.length && a[length] === b[length]) length++
  return length
}

const sameItems = <T>(a: readonly T[] | undefined, b: readonly T[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((item, i) => item === b[i]))

/** Whether two updates of an answer differ only by text received further on. */
const onlyTextGrew = (previous: Conversation, next: Conversation) => {
  const a = previous.messages.at(-1),
    b = next.messages.at(-1)
  return (
    !!a &&
    !!b &&
    previous.title === next.title &&
    previous.messages.length === next.messages.length &&
    a.state === b.state &&
    sameItems(a.widgets, b.widgets) &&
    sameItems(a.sources, b.sources) &&
    sameItems(a.routing, b.routing) &&
    sameItems(a.tools, b.tools)
  )
}

/**
 * Sits between the run and the screen: receives every update of the conversation and shows
 * the answer being written at `answerPace`. The rest of the message (tools, sources, cards)
 * goes through at once; only its text is held back. Stopping shows everything received.
 */
export class AnswerReveal {
  private target: Conversation | null = null
  private messageId: string | null = null
  private cursor: RevealCursor = startCursor
  private shownText = ''
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTick = 0
  private instant = false
  private flushed = false
  /** An answer is still being revealed. */
  active = false

  constructor(
    private readonly show: (conversation: Conversation) => void,
    private readonly onActiveChange: (active: boolean) => void,
    private readonly pace: AnswerPace = answerPace,
    private readonly now: () => number = Date.now
  ) {}

  /** The conversation as received, ahead of what the screen shows. */
  get latest() {
    return this.target
  }

  /** With reduced motion, answers show as they arrive. */
  setInstant(instant: boolean) {
    this.instant = instant
    if (instant) this.flush()
  }

  receive(conversation: Conversation) {
    const previous = this.target
    this.target = conversation
    const answer = conversation.messages.at(-1)
    if (answer?.role !== 'assistant') return this.finish()
    const sameAnswer = answer.id === this.messageId
    if (!sameAnswer) {
      this.messageId = answer.id
      this.cursor = startCursor
      this.shownText = ''
      this.flushed = false
      revealingFast = false
    }
    // An error or an interruption shows what was received, without making the reader wait.
    if (this.instant || this.flushed || !['streaming', 'complete'].includes(answer.state))
      return this.finish()
    // The stream was reset or rewritten: the reveal goes back to what still holds.
    if (!answer.text.startsWith(this.shownText)) {
      const index = commonPrefixLength(answer.text, this.shownText)
      this.cursor = { ...this.cursor, index }
    }
    this.setActive(true)
    if (!this.timer) {
      this.lastTick = this.now()
      this.timer = setInterval(() => this.tick(), this.pace.tickMs)
    }
    // Text received ahead of the reveal changes nothing on screen: the clock will show it.
    if (
      sameAnswer &&
      previous &&
      answer.text.startsWith(this.shownText) &&
      onlyTextGrew(previous, conversation)
    )
      return
    this.render(answer)
  }

  /** Shows everything received so far, and the rest of this answer as it arrives. */
  flush() {
    this.flushed = true
    this.finish()
  }

  /** Stops the clock without showing anything more. */
  stop() {
    this.clearTimer()
    this.target = null
    this.setActive(false)
  }

  private tick() {
    const answer = this.target?.messages.at(-1)
    if (!answer || answer.role !== 'assistant') return this.finish()
    const now = this.now()
    // A clock held back in the background must not release a whole paragraph at once.
    const elapsed = Math.min(now - this.lastTick, 250)
    this.lastTick = now
    const before = this.cursor.index
    this.cursor = advanceReveal(
      this.cursor,
      {
        text: answer.text,
        widgetIds: new Set((answer.widgets || []).map(widget => widget.id)),
        streaming: answer.state === 'streaming',
      },
      now,
      elapsed,
      this.pace
    )
    revealingFast = isFast(this.cursor.writtenMs, this.pace)
    if (answer.state !== 'streaming' && this.cursor.index >= answer.text.length)
      return this.finish()
    if (this.cursor.index !== before) this.render(answer)
  }

  private render(answer: LocalMessage) {
    const target = this.target!
    if (answer.state !== 'streaming' && this.cursor.index >= answer.text.length)
      return this.finish()
    const text = answer.text.slice(0, this.cursor.index)
    this.shownText = text
    this.show({
      ...target,
      messages: [...target.messages.slice(0, -1), { ...answer, text, state: 'streaming' }],
    })
  }

  private finish() {
    this.clearTimer()
    const target = this.target
    const answer = target?.messages.at(-1)
    if (answer?.role === 'assistant') {
      this.cursor = { ...startCursor, index: answer.text.length }
      this.shownText = answer.text
    }
    if (target) this.show(target)
    this.setActive(false)
  }

  private clearTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    this.onActiveChange(active)
  }
}
