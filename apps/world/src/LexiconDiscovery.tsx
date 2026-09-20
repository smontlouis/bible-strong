import { useEffect, useRef, useState } from 'react'
import { lexiconCopy } from './lexicon-discovery-copy'
import './lexicon-discovery.css'

export function LexiconDiscovery({
  language,
  onClose,
}: {
  language: keyof typeof lexiconCopy
  onClose: () => void
}) {
  const t = lexiconCopy[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const [slide, setSlide] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [passage, setPassage] = useState(0)
  const [sound, setSound] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')

  useEffect(() => {
    const previous = document.activeElement
    const modal = dialog.current!
    const player = audio.current
    modal.showModal()
    return () => {
      player?.pause()
      modal.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  function navigate(next: number) {
    if (next < 0 || next > 2) return
    audio.current?.pause()
    setSound('idle')
    setSlide(next)
    content.current?.scrollTo({ top: 0 })
  }

  async function listen() {
    const player = audio.current
    if (!player) return
    if (sound === 'playing') {
      player.pause()
      setSound('idle')
      return
    }
    setSound('loading')
    player.currentTime = 0
    try {
      await player.play()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (dialog.current?.open) setSound('error')
    }
  }

  return (
    <dialog
      ref={dialog}
      className="lexicon-dialog"
      aria-labelledby="lexicon-heading"
      onCancel={onClose}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={event => {
        if (event.target instanceof HTMLAudioElement) return
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          navigate(slide + (event.key === 'ArrowRight' ? 1 : -1))
        }
      }}
    >
      <div className="lexicon-shell">
        <header className="lexicon-header">
          <span>
            <span aria-hidden="true">א</span> {t.label}
          </span>
          <button className="lexicon-close" onClick={onClose} aria-label={t.close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div
          ref={content}
          className="lexicon-content"
          onTouchStart={event => {
            const touch = event.touches[0]
            gesture.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchCancel={() => {
            gesture.current = null
          }}
          onTouchEnd={event => {
            const start = gesture.current
            gesture.current = null
            if (!start) return
            const touch = event.changedTouches[0]
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
              navigate(slide + (dx < 0 ? 1 : -1))
          }}
        >
          <section key={slide} className="lexicon-slide" aria-label={`${slide + 1} / 3`}>
            <div className="lexicon-heading">
              <span className="lexicon-step">0{slide + 1} / 03</span>
              <h1 id="lexicon-heading">{t.titles[slide]}</h1>
              <p>{t.descriptions[slide]}</p>
            </div>
            {slide === 0 && (
              <>
                <img
                  className="lexicon-illustration"
                  src="./assets/discovery/lexicon.webp"
                  alt={t.illustration}
                />
                <div className="lexicon-verse">
                  <small>{t.reference}</small>
                  <p>
                    {t.before}
                    <button
                      className="lexicon-word"
                      aria-expanded={revealed}
                      onClick={() => setRevealed(true)}
                    >
                      {t.word}
                    </button>
                    {t.after}
                  </p>
                  <div className="lexicon-reveal" aria-live="polite">
                    {revealed ? (
                      <>
                        <strong lang="he" dir="rtl">
                          הֶבֶל
                        </strong>
                        <span>
                          hevel · H1892
                          <br />
                          {t.meaning}
                        </span>
                      </>
                    ) : (
                      <span>{t.touch} ↗</span>
                    )}
                  </div>
                  {revealed && <small className="lexicon-success">{t.revealed}</small>}
                </div>
              </>
            )}
            {slide === 1 && (
              <>
                <div className="lexicon-entry">
                  <div className="lexicon-entry-meta">
                    <span>{t.language}</span>
                    <span>H1892</span>
                  </div>
                  <div className="lexicon-hebrew" lang="he" dir="rtl">
                    הֶבֶל
                  </div>
                  <div className="lexicon-transliteration">hevel</div>
                  <button
                    className={`lexicon-listen ${sound === 'playing' ? 'is-playing' : ''}`}
                    onClick={listen}
                    disabled={sound === 'loading'}
                  >
                    <span className="lexicon-wave" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    {sound === 'loading' ? t.loading : sound === 'playing' ? t.playing : t.listen}
                  </button>
                  {sound === 'error' && (
                    <p role="alert" className="lexicon-audio-error">
                      {t.audioError}
                    </p>
                  )}
                  <hr />
                  <h2>{t.meaning}</h2>
                  <p>{t.definition}</p>
                </div>
                <span className="lexicon-handnote" aria-hidden="true">
                  א → hevel → {t.word}
                </span>
              </>
            )}
            {slide === 2 && (
              <>
                <div className="lexicon-source">
                  <span lang="he" dir="rtl">
                    הֶבֶל
                  </span>
                  <span>
                    hevel <small>H1892</small>
                  </span>
                </div>
                <div className="lexicon-passages">
                  {t.passages.map((item, index) => (
                    <button
                      key={item.reference}
                      aria-expanded={passage === index}
                      onClick={() => setPassage(index)}
                    >
                      <span className="lexicon-passage-top">
                        <strong>{item.label}</strong>
                        <span>{passage === index ? '−' : '+'}</span>
                      </span>
                      <small>{item.reference}</small>
                      {passage === index && <p>{item.text}</p>}
                    </button>
                  ))}
                </div>
                <div className="lexicon-more">
                  <h2>{t.more}</h2>
                  <p>{t.possibilities}</p>
                  <a href={t.lexiconUrl} target="_blank" rel="noreferrer">
                    {t.open} ↗
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
        <footer className="lexicon-footer">
          <div className="lexicon-navigation">
            <button
              className="lexicon-back"
              disabled={slide === 0}
              onClick={() => navigate(slide - 1)}
              aria-label={t.previous}
            >
              ←
            </button>
            <nav aria-label={t.progress}>
              {t.titles.map((title, index) => (
                <button
                  key={title}
                  aria-label={`${index + 1}. ${title}`}
                  aria-current={slide === index ? 'step' : undefined}
                  onClick={() => navigate(index)}
                />
              ))}
            </nav>
            <span aria-live="polite">{slide + 1} / 3</span>
          </div>
          <button
            className="lexicon-next"
            onClick={() => (slide === 2 ? onClose() : navigate(slide + 1))}
          >
            {slide === 2 ? t.finish : t.next}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
      <audio
        ref={audio}
        preload="none"
        src="https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/1892h.mp3"
        onPlaying={() => setSound('playing')}
        onEnded={() => setSound('idle')}
        onError={() => setSound('error')}
      />
    </dialog>
  )
}
