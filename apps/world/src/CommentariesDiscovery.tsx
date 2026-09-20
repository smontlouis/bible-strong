import { useState } from 'react'
import { DiscoveryDialog } from './DiscoveryDialog'
import { commentariesCopy } from './commentaries-discovery-copy'
import './commentaries-discovery.css'

function CommentaryIcon() {
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
      <path d="M4 4h16v12H9l-5 4V4Z" strokeLinejoin="round" />
      <path d="M8 8h8M8 12h5" strokeLinecap="round" />
    </svg>
  )
}

export function CommentariesDiscovery({
  language,
  onClose,
}: {
  language: 'fr' | 'en'
  onClose: () => void
}) {
  const t = commentariesCopy[language]
  const [revealed, setRevealed] = useState(false)
  const [insight, setInsight] = useState(0)
  const [question, setQuestion] = useState(0)
  return (
    <DiscoveryDialog
      copy={t}
      icon={<CommentaryIcon />}
      className="commentaries-dialog"
      onClose={onClose}
    >
      {slide => (
        <>
          {slide === 0 && (
            <>
              <img
                className="lexicon-illustration"
                src="./assets/discovery/commentaries.webp"
                alt={t.illustration}
              />
              <div className="lexicon-verse commentaries-verse">
                <small>{t.reference}</small>
                <p>{t.verse}</p>
                <button
                  className="commentaries-reveal"
                  aria-expanded={revealed}
                  onClick={() => setRevealed(!revealed)}
                >
                  <CommentaryIcon />
                  {revealed ? t.hide : t.reveal}
                  <span aria-hidden="true">{revealed ? '−' : '+'}</span>
                </button>
              </div>
              {revealed && (
                <div className="commentaries-insight" aria-live="polite">
                  <strong>{t.author}</strong>
                  <p>{t.firstInsight}</p>
                  <small>{t.source}</small>
                </div>
              )}
            </>
          )}
          {slide === 1 && (
            <>
              <div className="commentaries-author">
                <span aria-hidden="true">MH</span>
                <div>
                  <strong>{t.author}</strong>
                  <small>{t.work}</small>
                </div>
              </div>
              <p className="commentaries-hint">{t.choose}</p>
              <div className="commentaries-choices" aria-label={t.choose}>
                {t.insights.map((item, index) => (
                  <button
                    key={item.title}
                    aria-pressed={insight === index}
                    onClick={() => setInsight(index)}
                  >
                    <span aria-hidden="true">0{index + 1}</span>
                    {item.title}
                  </button>
                ))}
              </div>
              <div className="commentaries-insight" key={insight} aria-live="polite">
                <h2>{t.insights[insight].title}</h2>
                <p>{t.insights[insight].text}</p>
              </div>
              <p className="commentaries-source">
                {t.source}{' '}
                <a
                  href="https://ccel.org/ccel/henry/mhcc.xx.xxiii.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.sourceLink} ↗
                </a>
              </p>
            </>
          )}
          {slide === 2 && (
            <>
              <div className="lexicon-verse commentaries-verse">
                <small>{t.reference}</small>
                <p>{t.verse}</p>
              </div>
              <p className="commentaries-hint">{t.reflect}</p>
              <div className="commentaries-choices" aria-label={t.reflect}>
                {t.questions.map((item, index) => (
                  <button
                    key={item.title}
                    aria-pressed={question === index}
                    onClick={() => setQuestion(index)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <div className="commentaries-question" key={question} aria-live="polite">
                <span aria-hidden="true">?</span>
                <p>{t.questions[question].text}</p>
              </div>
              <div className="lexicon-more">
                <h2>{t.more}</h2>
                <p>{t.possibilities}</p>
                <a
                  href="https://web.bible-strong.app/commentary-library"
                  target="_blank"
                  rel="noreferrer"
                >
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
