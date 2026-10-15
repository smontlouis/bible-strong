// A station's dialogue in the manner of a story-driven game: the speaker appears large on one
// side, a paper box at the bottom types the line, and each line sets the speaker's mood.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { haptic } from '../haptics'
import type { Language } from '../language'
import { Modal } from '../Modal'
import { PlaceBackdrop } from './PlaceBackdrop'
import busts from './generated/busts.json'
import { valenceCopy } from './valence-copy'
import {
  speakers,
  type BeatKind,
  type Line,
  type Mood,
  type SpeakerId,
  type Station,
  type TodayPanel,
} from './valence-story'

export const MOODS: Mood[] = ['neutral', 'happy', 'thinking', 'surprised', 'grave']
export const bustImage = (speaker: SpeakerId, mood: Mood) => `./valence-1876/busts/${speaker}/${mood}.webp`
/** Children are drawn smaller than adults; heights are relative to the stage. */
const BUST_SCALE: Partial<Record<SpeakerId, number>> = { crier: 0.84, elise: 0.94 }
const CHARS_PER_SECOND = 48
const PAUSES: Record<string, number> = { '.': 260, '!': 260, '?': 260, '…': 300, ':': 200, ';': 200, ',': 110 }
const FIRST_LETTER_MS = 120

/** How long the typewriter takes to reveal `text`, in milliseconds. */
export function typingTime(text: string) {
  let total = FIRST_LETTER_MS
  for (const letter of text) total += 1000 / CHARS_PER_SECOND + (PAUSES[letter] ?? 0)
  return total
}

export type Step = { beat: BeatKind; line?: Line }

export function steps(station: Station): Step[] {
  return [
    ...station.fact.map(line => ({ beat: 'fact' as const, line })),
    ...station.study.map(line => ({ beat: 'study' as const, line })),
    ...(station.today ? [{ beat: 'today' as const }] : []),
  ]
}

export function TodayView({ today, language }: { today: TodayPanel; language: Language }) {
  const t = valenceCopy[language]
  return (
    <section className="v-today" aria-label={t.todayEyebrow}>
      <div className="v-today-copy">
        <p className="v-eyebrow-bs">{t.todayEyebrow}</p>
        <h3>{today.title[language]}</h3>
        <p>{today.body[language]}</p>
        {today.verse && (
          <blockquote>
            <p>{today.verse.text[language]}</p>
            <cite>
              {today.verse.reference[language]} ({language === 'fr' ? 'LSG' : 'KJV'})
            </cite>
          </blockquote>
        )}
        <a
          className="v-cta"
          href={today.url[language]}
          target="_blank"
          rel="noreferrer"
          onClick={event => {
            event.stopPropagation()
            haptic('select')
          }}
        >
          {today.cta[language]}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      <figure className="v-phone">
        <img src={today.screenshot} alt="" loading="lazy" />
      </figure>
    </section>
  )
}

/** Reveals `text` letter by letter, pausing on punctuation; instant with reduced motion. */
export function useTypewriter(text: string, key: number) {
  // The count belongs to one line: a new line starts hidden even before the effect runs.
  const [state, setState] = useState({ key, count: 0 })
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useEffect(() => {
    if (reduced) {
      setState({ key, count: text.length })
      return
    }
    setState({ key, count: 0 })
    let shown = 0
    let wait = FIRST_LETTER_MS
    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      wait -= now - last
      last = now
      while (wait <= 0 && shown < text.length) {
        shown++
        wait += 1000 / CHARS_PER_SECOND + (PAUSES[text[shown - 1]] ?? 0)
      }
      setState(current => (current.key === key ? { key, count: Math.max(current.count, shown) } : current))
      if (shown < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, key, reduced])
  const count = state.key === key ? state.count : 0
  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    finish: () => setState({ key, count: text.length }),
  }
}

export function Bust({
  speaker,
  mood,
  side,
  active,
  lineKey,
}: {
  speaker: SpeakerId
  mood: Mood
  side: 'left' | 'right'
  active: boolean
  lineKey: number
}) {
  const figure = useRef<HTMLElement>(null)
  // A small hop each time this character starts a new line.
  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    figure.current?.animate(
      [{ translate: '0 0' }, { translate: '0 -14px' }, { translate: '0 0' }],
      { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    )
  }, [active, lineKey])
  return (
    <figure
      ref={figure}
      className="v-bust"
      data-side={side}
      data-active={active}
      style={
        {
          '--bust-scale': BUST_SCALE[speaker] ?? 1,
          aspectRatio: String((busts as Record<string, { aspect: number }>)[speaker]?.aspect ?? 2 / 3),
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {MOODS.map(key => (
        <img key={key} src={bustImage(speaker, key)} alt="" data-shown={key === mood} draggable={false} />
      ))}
    </figure>
  )
}

export function StationScene({
  station,
  language,
  onClose,
  closing,
}: {
  station: Station
  language: Language
  onClose: () => void
  closing?: ReactNode
}) {
  const t = valenceCopy[language]
  const titleId = useId()
  const list = useMemo(() => steps(station), [station])
  const [index, setIndex] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const step = list[index]
  const line = step.line
  const text = line?.text[language] ?? ''
  const typing = useTypewriter(text, index)
  const last = index === list.length - 1
  const advanceButton = useRef<HTMLButtonElement>(null)

  // First speaker on the left, second on the right; narrators never appear.
  const cast = useMemo(() => {
    const order: SpeakerId[] = []
    for (const { line } of list)
      if (line && speakers[line.speaker].kind !== 'narrator' && !order.includes(line.speaker)) order.push(line.speaker)
    return order
  }, [list])
  const moods = useMemo(() => {
    const current = new Map<SpeakerId, Mood>()
    for (const { line } of list.slice(0, index + 1)) if (line?.mood) current.set(line.speaker, line.mood)
    return current
  }, [list, index])
  const appeared = new Set(list.slice(0, index + 1).flatMap(s => (s.line ? [s.line.speaker] : [])))
  const speaker = line ? speakers[line.speaker] : null
  const narrating = speaker?.kind === 'narrator'
  const side = line && cast.indexOf(line.speaker) === 1 ? 'right' : 'left'
  const beats = (['fact', 'study', 'today'] as BeatKind[]).filter(beat => list.some(s => s.beat === beat))
  const beatLabel = (beat: BeatKind) => (station.id === 'rhone' && beat === 'study' ? t.epilogue : t.beats[beat])

  useEffect(() => {
    for (const id of cast) for (const mood of MOODS) new Image().src = bustImage(id, mood)
  }, [cast])

  const lastAdvance = useRef(0)
  function advance() {
    // A quick double tap finishes the line instead of skipping the next one.
    const now = performance.now()
    if (now - lastAdvance.current < 160) return
    lastAdvance.current = now
    if (line && !typing.done) {
      typing.finish()
      return
    }
    if (last) return
    haptic('tick')
    setIndex(value => value + 1)
  }
  function back() {
    if (index > 0) setIndex(value => value - 1)
  }

  return (
    <Modal
      className="valence-modal v-scene"
      labelledBy={titleId}
      closeLabel={t.close}
      onClose={onClose}
      initialFocus={advanceButton}
      onKeyDown={event => {
        if (historyOpen) return
        if (event.target instanceof HTMLAnchorElement) return
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
          event.preventDefault()
          advance()
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          back()
        }
      }}
    >
      <div
        className="v-scene-stage"
        data-step={step.beat}
        data-narrating={narrating}
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('button, a, .v-scene-panel')) return
          advance()
        }}
      >
        {/* On a phone the window fills the screen: the place, blurred, stands behind it. */}
        <PlaceBackdrop station={station} className="v-scene-place" />
        <header className="v-scene-top">
          <p className="v-date">{station.date[language]}</p>
          <h2 id={titleId}>
            {station.place[language]}
            <span> · {station.title[language]}</span>
          </h2>
          <ol className="v-scene-beats" aria-label={station.place[language]}>
            {beats.map(beat => (
              <li key={beat} data-current={beat === step.beat} data-done={beats.indexOf(beat) < beats.indexOf(step.beat)}>
                {beatLabel(beat)}
              </li>
            ))}
          </ol>
          {/* On a phone the beats are three short bars: this names the current one. */}
          <p className="v-scene-beat-now">{beatLabel(step.beat)}</p>
          <div className="v-scene-tools">
            <button
              type="button"
              aria-expanded={historyOpen}
              aria-label={t.history}
              title={t.history}
              onClick={() => setHistoryOpen(open => !open)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 5h16M4 10h16M4 15h10M4 20h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{t.history}</span>
            </button>
          </div>
        </header>

        <div className="v-scene-cast" data-hidden={step.beat === 'today'}>
          {cast.map((id, position) =>
            appeared.has(id) ? (
              <Bust
                key={id}
                speaker={id}
                mood={moods.get(id) ?? 'neutral'}
                side={position === 1 ? 'right' : 'left'}
                active={line?.speaker === id}
                lineKey={index}
              />
            ) : null
          )}
        </div>

        {line && narrating && (
          <div className="v-carton" key={index}>
            <p className="v-carton-eyebrow">{t.narrator}</p>
            <p className="v-carton-text" aria-hidden="true">
              {typing.shown}
              <span className="v-ghost">{text.slice(typing.shown.length)}</span>
            </p>
            <p className="v-sr-only" aria-live="polite">
              {text}
            </p>
          </div>
        )}

        {line && !narrating && speaker && (
          <div className="v-box" data-side={side}>
            <p className="v-nameplate">
              <strong>{speaker.name[language]}</strong>
              {speaker.role[language] && <span>{speaker.role[language]}</span>}
            </p>
            <p className="v-box-text" aria-hidden="true">
              {typing.shown}
              <span className="v-ghost">{text.slice(typing.shown.length)}</span>
            </p>
            <p className="v-sr-only" aria-live="polite">
              {speaker.name[language]} : {text}
            </p>
          </div>
        )}

        {step.beat === 'today' && station.today && (
          <div className="v-scene-today">
            <TodayView today={station.today} language={language} />
          </div>
        )}

        {last && (line ? typing.done : true) && closing && <div className="v-scene-closing">{closing}</div>}

        <nav className="v-scene-nav">
          <button type="button" className="v-scene-back" disabled={index === 0} onClick={back} aria-label={t.previous}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {last && (line ? typing.done : true) ? (
            <button type="button" className="v-primary" ref={advanceButton} onClick={onClose}>
              {t.close}
            </button>
          ) : (
            <button
              type="button"
              className="v-scene-next"
              ref={advanceButton}
              onClick={advance}
              data-waiting={!line || typing.done}
              aria-label={!line || typing.done ? t.next : t.skip}
            >
              {line && !typing.done ? t.skip : list[index + 1]?.beat !== step.beat ? beatLabel(list[index + 1].beat) : t.next}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </nav>

        {historyOpen && (
          <aside className="v-scene-panel" aria-label={t.history}>
            <h3>{t.history}</h3>
            <ol>
              {list.slice(0, index + 1).flatMap(({ line }, position) =>
                line ? (
                  <li key={position} data-kind={speakers[line.speaker].kind}>
                    <strong>{speakers[line.speaker].kind === 'narrator' ? t.narrator : speakers[line.speaker].name[language]}</strong>
                    <p>{line.text[language]}</p>
                  </li>
                ) : []
              )}
            </ol>
            <button type="button" onClick={() => setHistoryOpen(false)}>
              {t.close}
            </button>
          </aside>
        )}
      </div>
    </Modal>
  )
}
