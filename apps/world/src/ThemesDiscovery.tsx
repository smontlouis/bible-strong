import { useState } from 'react'
import { DiscoveryDialog } from './DiscoveryDialog'
import { themesCopy } from './themes-discovery-copy'
import './themes-discovery.css'

function ThemeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="m12 12-6-6m6 6 6-6m-6 6v7" />
      <circle cx="5" cy="5" r="3" />
      <circle cx="19" cy="5" r="3" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="21" r="2" />
    </svg>
  )
}

export function ThemesDiscovery({
  language,
  onClose,
}: {
  language: 'fr' | 'en'
  onClose: () => void
}) {
  const t = themesCopy[language]
  const [revealed, setRevealed] = useState(false)
  const [passage, setPassage] = useState(0)
  const [topic, setTopic] = useState(0)
  return (
    <DiscoveryDialog copy={t} icon={<ThemeIcon />} className="themes-dialog" onClose={onClose}>
      {slide => (
        <>
          {slide === 0 && (
            <>
              <img
                className="lexicon-illustration"
                src="./assets/discovery/themes.webp"
                alt={t.illustration}
              />
              <div className="themes-map">
                <small>{t.question}</small>
                <button
                  className="themes-seed"
                  aria-expanded={revealed}
                  onClick={() => setRevealed(!revealed)}
                >
                  <ThemeIcon />
                  {t.topic}
                  <span aria-hidden="true">{revealed ? '−' : '+'}</span>
                </button>
                <div className="themes-branches" aria-live="polite">
                  {revealed ? (
                    <>
                      <div>
                        {t.passages.map(item => (
                          <span key={item.title}>{item.title}</span>
                        ))}
                      </div>
                      <p>{t.revealed}</p>
                    </>
                  ) : (
                    <p>{t.tap} ↗</p>
                  )}
                </div>
              </div>
            </>
          )}
          {slide === 1 && (
            <>
              <div className="themes-topic-label">
                <ThemeIcon />
                <strong>{t.topic}</strong>
              </div>
              <p className="themes-hint">{t.hint}</p>
              <div className="themes-choices" aria-label={t.hint}>
                {t.passages.map((item, index) => (
                  <button
                    key={item.title}
                    aria-pressed={passage === index}
                    onClick={() => setPassage(index)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <div className="lexicon-verse themes-reading" key={passage} aria-live="polite">
                <small>{t.passages[passage].reference}</small>
                <p>{t.passages[passage].text}</p>
              </div>
              <p className="themes-note">{t.note}</p>
            </>
          )}
          {slide === 2 && (
            <>
              <div className="themes-topic-label">
                <ThemeIcon />
                <strong>{t.choose}</strong>
              </div>
              <div className="themes-choices" aria-label={t.choose}>
                {t.topics.map((item, index) => (
                  <button
                    key={item.title}
                    aria-pressed={topic === index}
                    onClick={() => setTopic(index)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <div className="themes-preview" key={topic} aria-live="polite">
                <span aria-hidden="true">↳</span>
                <p>{t.topics[topic].text}</p>
              </div>
              <div className="lexicon-more">
                <h2>{t.more}</h2>
                <p>{t.possibilities}</p>
                <a href="https://web.bible-strong.app/nave" target="_blank" rel="noreferrer">
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
