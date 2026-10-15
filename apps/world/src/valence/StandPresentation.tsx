// A stand screen's presentation of a place while the tour stops there: the characters in bust,
// the line typed beneath them, playing on its own, bottom left. It shows the history and the
// dialogue, not the Bible Strong page of today: that is for the visitors who scan.
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Language } from '../language'
import { Bust, MOODS, bustImage, steps, typingTime, useTypewriter } from './StationScene'
import { valenceCopy } from './valence-copy'
import { speakers, type Mood, type SpeakerId, type Station } from './valence-story'
import { PlaceBackdrop } from './PlaceBackdrop'

/** Reading time after a line is typed: a pause, then about a word every quarter second. */
const readingTime = (text: string) => 1400 + text.length * 32

export function StandPresentation({ station, language, onDone }: { station: Station; language: Language; onDone: () => void }) {
  const t = valenceCopy[language]
  const list = useMemo(() => steps(station).filter(step => step.line), [station])
  const [index, setIndex] = useState(0)
  const line = list[index]?.line
  const text = line?.text[language] ?? ''
  const typing = useTypewriter(text, index)
  // Each line's time on screen, typed then read, for the progress bar.
  const durations = useMemo(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return list.map(step => {
      const words = step.line!.text[language]
      return (reduced ? 0 : typingTime(words)) + readingTime(words)
    })
  }, [list, language])
  const total = durations.reduce((sum, value) => sum + value, 0)
  const before = durations.slice(0, index).reduce((sum, value) => sum + value, 0)

  // First speaker on the left, second on the right; narrators never appear.
  const cast = useMemo(() => {
    const order: SpeakerId[] = []
    for (const step of list)
      if (step.line && speakers[step.line.speaker].kind !== 'narrator' && !order.includes(step.line.speaker))
        order.push(step.line.speaker)
    return order
  }, [list])
  const moods = useMemo(() => {
    const current = new Map<SpeakerId, Mood>()
    for (const step of list.slice(0, index + 1)) if (step.line?.mood) current.set(step.line.speaker, step.line.mood)
    return current
  }, [list, index])
  const appeared = new Set(list.slice(0, index + 1).flatMap(step => (step.line ? [step.line.speaker] : [])))
  const speaker = line ? speakers[line.speaker] : null
  const narrating = speaker?.kind === 'narrator'
  const side = line && cast.indexOf(line.speaker) === 1 ? 'right' : 'left'

  useEffect(() => {
    for (const id of cast) for (const mood of MOODS) new Image().src = bustImage(id, mood)
  }, [cast])

  // Each line stays long enough to be read, then the next one comes; the last one ends the stop.
  useEffect(() => {
    if (!typing.done) return
    const timer = setTimeout(() => (index < list.length - 1 ? setIndex(index + 1) : onDone()), readingTime(text))
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing.done, index])

  if (!line || !speaker) return null
  return (
    <section className="v-presenter" data-narrating={narrating} aria-label={station.place[language]}>
      {/* How far the place's presentation has come, line after line. */}
      <div className="stand-progress" aria-hidden="true">
        <span
          key={index}
          style={
            {
              '--from': before / total,
              '--to': (before + durations[index]) / total,
              '--duration': `${durations[index]}ms`,
            } as CSSProperties
          }
        />
      </div>
      <header className="v-presenter-top">
        <span className="v-tag-order">{station.order}</span>
        <span>
          <span className="v-tag-date">{station.date[language]}</span>
          <span className="v-tag-place">{station.place[language]}</span>
        </span>
      </header>
      {/* The place itself behind the characters, out of focus, as the camera shows it. */}
      <PlaceBackdrop station={station} className="v-presenter-place" />
      <div className="v-scene-cast">
        {cast.map((id, position) =>
          appeared.has(id) ? (
            <Bust
              key={id}
              speaker={id}
              mood={moods.get(id) ?? 'neutral'}
              side={position === 1 ? 'right' : 'left'}
              active={line.speaker === id}
              lineKey={index}
            />
          ) : null
        )}
      </div>
      {narrating ? (
        <div className="v-carton" key={index}>
          <p className="v-carton-eyebrow">{t.narrator}</p>
          <p className="v-carton-text">
            {typing.shown}
            <span className="v-ghost">{text.slice(typing.shown.length)}</span>
          </p>
        </div>
      ) : (
        <div className="v-box" data-side={side}>
          <p className="v-nameplate">
            <strong>{speaker.name[language]}</strong>
            {speaker.role[language] && <span>{speaker.role[language]}</span>}
          </p>
          <p className="v-box-text">
            {typing.shown}
            <span className="v-ghost">{text.slice(typing.shown.length)}</span>
          </p>
        </div>
      )}
    </section>
  )
}
