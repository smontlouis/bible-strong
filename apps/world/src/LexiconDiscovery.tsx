import { useEffect, useRef, useState } from 'react'
import { lexiconCopy } from './lexicon-discovery-copy'
import { DiscoveryDialog } from './DiscoveryDialog'

export function LexiconDiscovery({
  language,
  onClose,
}: {
  language: keyof typeof lexiconCopy
  onClose: () => void
}) {
  const t = lexiconCopy[language]
  const audio = useRef<HTMLAudioElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [passage, setPassage] = useState(0)
  const [sound, setSound] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')

  useEffect(() => {
    const player = audio.current
    return () => {
      player?.pause()
    }
  }, [])
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
      if (audio.current) setSound('error')
    }
  }

  return (
    <DiscoveryDialog
      copy={t}
      icon="א"
      onClose={onClose}
      onNavigate={() => {
        audio.current?.pause()
        setSound('idle')
      }}
      media={
        <audio
          ref={audio}
          preload="none"
          src="https://content.swncdn.com/biblestudytools/audio/lexicons/hebrew-mp3/1892h.mp3"
          onPlaying={() => setSound('playing')}
          onEnded={() => setSound('idle')}
          onError={() => setSound('error')}
        />
      }
    >
      {slide => (
        <>
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
        </>
      )}
    </DiscoveryDialog>
  )
}
