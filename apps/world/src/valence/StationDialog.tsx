import { useEffect, useId, useRef, useState } from 'react'
import { haptic } from '../haptics'
import type { Language } from '../language'
import { Modal } from '../Modal'
import { valenceCopy } from './valence-copy'
import { speakers, type BeatKind, type Line, type Station, type TodayPanel } from './valence-story'

const portrait = (speaker: string) => `./valence-1876/portraits/${speaker}.webp`

function LineView({ line, language }: { line: Line; language: Language }) {
  const speaker = speakers[line.speaker]
  const t = valenceCopy[language]
  if (speaker.kind === 'narrator')
    return (
      <li className="v-line v-line-note">
        <span className="v-note-label">{t.narrator}</span>
        <p>{line.text[language]}</p>
      </li>
    )
  return (
    <li className="v-line" data-kind={speaker.kind}>
      <img className="v-portrait" src={portrait(line.speaker)} alt="" width={64} height={64} />
      <div className="v-line-body">
        <p className="v-speaker">
          <strong>{speaker.name[language]}</strong>
          {speaker.role[language] && <span>{speaker.role[language]}</span>}
          <em className="v-kind" data-kind={speaker.kind}>
            {speaker.kind === 'real' ? t.realShort : t.composite}
          </em>
        </p>
        <p className="v-text">{line.text[language]}</p>
      </div>
    </li>
  )
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
          onClick={() => haptic('select')}
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

export function StationDialog({
  station,
  language,
  onClose,
  onFinished,
  closing,
}: {
  station: Station
  language: Language
  onClose: () => void
  onFinished?: () => void
  closing?: React.ReactNode
}) {
  const t = valenceCopy[language]
  const titleId = useId()
  const beats = (['fact', 'study', 'today'] as BeatKind[]).filter(beat =>
    beat === 'today' ? station.today !== null : station[beat].length > 0
  )
  const [beat, setBeat] = useState<BeatKind>(beats[0])
  const [shown, setShown] = useState(1)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const next = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const lines = beat === 'today' ? [] : station[beat]
  const index = beats.indexOf(beat)
  const lastBeat = index === beats.length - 1
  const allShown = beat === 'today' || shown >= lines.length
  const finished = lastBeat && allShown
  const kinds = new Set(lines.slice(0, shown).map(line => speakers[line.speaker].kind))
  const beatLabel = (kind: BeatKind) =>
    station.id === 'rhone' && kind === 'study' ? t.epilogue : t.beats[kind]

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shown, beat])
  useEffect(() => {
    if (finished) onFinished?.()
  }, [finished, onFinished])

  function advance() {
    haptic('tap')
    if (!allShown) {
      setShown(value => value + 1)
      return
    }
    if (!lastBeat) {
      setBeat(beats[index + 1])
      setShown(1)
    }
  }

  return (
    <Modal
      className="valence-modal v-station"
      labelledBy={titleId}
      closeLabel={t.close}
      onClose={onClose}
      initialFocus={next}
    >
      <header className="v-station-head">
        <p className="v-date">{station.date[language]}</p>
        <h2 id={titleId}>
          {station.place[language]}
          <span> · {station.title[language]}</span>
        </h2>
        <nav className="v-beats" aria-label={station.place[language]}>
          {beats.map((kind, position) => (
            <button
              key={kind}
              type="button"
              aria-pressed={kind === beat}
              data-done={position < index}
              onClick={() => {
                setBeat(kind)
                setShown(kind === 'today' ? 0 : station[kind].length)
              }}
            >
              <span aria-hidden="true">{position + 1}</span>
              {beatLabel(kind)}
            </button>
          ))}
        </nav>
      </header>
      <div className="v-station-body" data-beat={beat}>
        {beat === 'today' && station.today ? (
          <TodayView today={station.today} language={language} />
        ) : (
          <ol className="v-lines" ref={list} aria-live="polite">
            {lines.slice(0, shown).map((line, position) => (
              <LineView key={`${beat}-${position}`} line={line} language={language} />
            ))}
          </ol>
        )}
        {finished && closing}
      </div>
      <footer className="v-station-foot">
        <div className="v-kinds">
          {kinds.has('real') && <span className="v-kinds-note">{t.real}</span>}
          <button
            type="button"
            className="v-sources-toggle"
            aria-expanded={sourcesOpen}
            onClick={() => setSourcesOpen(open => !open)}
          >
            {t.sources}
          </button>
        </div>
        {sourcesOpen && (
          <div className="v-sources">
            <p>{t.sourcesIntro}</p>
            <ul>
              {station.sources.map(source => (
                <li key={source.label}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="v-nav">
          <button
            type="button"
            className="v-secondary"
            disabled={index === 0 && shown <= 1}
            onClick={() => {
              if (beat !== 'today' && shown > 1) setShown(value => value - 1)
              else if (index > 0) {
                const previous = beats[index - 1]
                setBeat(previous)
                setShown(previous === 'today' ? 0 : station[previous].length)
              }
            }}
          >
            {t.previous}
          </button>
          {finished ? (
            <button type="button" className="v-primary" ref={next} onClick={onClose}>
              {t.close}
            </button>
          ) : (
            <button type="button" className="v-primary" ref={next} onClick={advance}>
              {allShown ? beatLabel(beats[index + 1]) : t.next}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </footer>
    </Modal>
  )
}
