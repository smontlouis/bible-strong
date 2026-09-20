import { useState } from 'react'
import { DiscoveryDialog } from './DiscoveryDialog'
import { dictionaryCopy } from './dictionary-discovery-copy'
import './dictionary-discovery.css'

function ContextIcon({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'coins' ? (
        <>
          <ellipse cx="13" cy="10" rx="8" ry="4" />
          <path d="M5 10v6c0 5 16 5 16 0v-6M5 16v6c0 5 16 5 16 0v-6M23 14c5 0 6 2 6 4v6c0 3-4 4-7 4" />
        </>
      ) : kind === 'people' ? (
        <>
          <circle cx="12" cy="10" r="5" />
          <path d="M3 27v-4a9 9 0 0 1 18 0v4M22 5a5 5 0 0 1 0 10M25 19c4 1 5 4 5 8" />
        </>
      ) : (
        <>
          <path d="M16 8C12 5 6 5 2 7v20c5-2 10-2 14 1 4-3 9-3 14-1V7c-4-2-10-2-14 1v20M6 12h6M20 12h6M6 17h6M20 17h6" />
        </>
      )}
    </svg>
  )
}

export function DictionaryDiscovery({
  language,
  onClose,
}: {
  language: keyof typeof dictionaryCopy
  onClose: () => void
}) {
  const t = dictionaryCopy[language]
  const [revealed, setRevealed] = useState(false)
  const [fact, setFact] = useState<number | null>(0)
  const [passage, setPassage] = useState<number | null>(0)
  return (
    <DiscoveryDialog
      copy={t}
      icon={<ContextIcon kind="book" />}
      className="dictionary-dialog"
      onClose={onClose}
    >
      {slide => (
        <>
          {slide === 0 && (
            <>
              <img
                className="lexicon-illustration"
                src="./assets/discovery/dictionary.webp"
                alt={t.illustration}
              />
              <div className="lexicon-verse">
                <small>{t.reference}</small>
                <p>
                  {t.before}
                  <button
                    className="lexicon-word"
                    aria-expanded={revealed}
                    onClick={() => setRevealed(value => !value)}
                  >
                    {t.word}
                  </button>
                  {t.after}
                </p>
                <div className="lexicon-reveal" aria-live="polite">
                  {revealed ? (
                    <>
                      <ContextIcon kind="coins" />
                      <span>{t.revealed}</span>
                    </>
                  ) : (
                    <span>{t.touch} ↗</span>
                  )}
                </div>
              </div>
            </>
          )}
          {slide === 1 && (
            <>
              <div className="dictionary-entry">
                <small>{t.category}</small>
                <h2>{t.entry}</h2>
                <p>{t.summary}</p>
              </div>
              <p className="dictionary-hint">{t.hint}</p>
              <div className="dictionary-facts">
                {t.facts.map((item, index) => (
                  <button
                    key={item.title}
                    aria-expanded={fact === index}
                    onClick={() => setFact(fact === index ? null : index)}
                  >
                    <span className="dictionary-fact-title">
                      <ContextIcon kind={item.icon} />
                      <strong>{item.title}</strong>
                      <span>{fact === index ? '−' : '+'}</span>
                    </span>
                    {fact === index && <p>{item.text}</p>}
                  </button>
                ))}
              </div>
              <p className="dictionary-source">{t.source}</p>
            </>
          )}
          {slide === 2 && (
            <>
              <div className="dictionary-connection" aria-hidden="true">
                <ContextIcon kind="book" />
                <span>{t.entry}</span>
                <span>↘</span>
              </div>
              <div className="lexicon-passages">
                {t.passages.map((item, index) => (
                  <button
                    key={item.reference}
                    aria-expanded={passage === index}
                    onClick={() => setPassage(passage === index ? null : index)}
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
                <a
                  href="https://web.bible-strong.app/dictionnaire"
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
