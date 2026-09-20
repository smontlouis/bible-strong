import { useState } from 'react'
import { DiscoveryDialog } from './DiscoveryDialog'
import { referencesCopy } from './references-discovery-copy'
import './references-discovery.css'

function ConnectionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="m7 7 10 5-10 5" />
      <circle cx="5" cy="6" r="3" />
      <circle cx="19" cy="12" r="3" />
      <circle cx="5" cy="18" r="3" />
    </svg>
  )
}

export function ReferencesDiscovery({
  language,
  onClose,
}: {
  language: 'fr' | 'en'
  onClose: () => void
}) {
  const t = referencesCopy[language]
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [step, setStep] = useState(0)
  const passage = t.passages[selected]
  return (
    <DiscoveryDialog
      copy={t}
      icon={<ConnectionIcon />}
      className="references-dialog"
      onClose={onClose}
    >
      {slide => (
        <>
          {slide === 0 && (
            <>
              <img
                className="lexicon-illustration"
                src="./assets/discovery/references.webp"
                alt={t.illustration}
              />
              <div className="lexicon-verse">
                <small>{t.reference}</small>
                <p>
                  {t.before}
                  <mark className="references-highlight">{t.word}</mark>
                  {t.after}
                </p>
                <button
                  className="references-reveal"
                  aria-expanded={revealed}
                  onClick={() => setRevealed(!revealed)}
                >
                  <ConnectionIcon />
                  {revealed ? t.hide : t.touch}
                </button>
                {revealed && (
                  <div className="references-preview" role="status">
                    {t.connected}
                  </div>
                )}
              </div>
            </>
          )}
          {slide === 1 && (
            <>
              <div className="references-thread">
                <ConnectionIcon />
                <strong>{t.thread}</strong>
              </div>
              <p className="references-hint">{t.hint}</p>
              <div className="references-choices" aria-label={t.hint}>
                {t.passages.map((item, index) => (
                  <button
                    key={item.reference}
                    aria-pressed={selected === index}
                    onClick={() => setSelected(index)}
                  >
                    {item.reference}
                  </button>
                ))}
              </div>
              <div className="references-card" key={selected} aria-live="polite">
                <span className="references-card-number" aria-hidden="true">
                  0{selected + 1}
                </span>
                <h2>{passage.label}</h2>
                <blockquote>{passage.text}</blockquote>
                <small>{passage.reference}</small>
                <p>{passage.insight}</p>
              </div>
            </>
          )}
          {slide === 2 && (
            <>
              <div className="references-steps">
                {t.steps.map((item, index) => (
                  <button
                    key={item.title}
                    aria-expanded={step === index}
                    onClick={() => setStep(index)}
                  >
                    <span className="references-step-number">{index + 1}</span>
                    <span>
                      <strong>{item.title}</strong>
                      {step === index && (
                        <span className="references-step-detail">{item.text}</span>
                      )}
                    </span>
                    <span aria-hidden="true">{step === index ? '−' : '+'}</span>
                  </button>
                ))}
              </div>
              <img
                className="lexicon-illustration references-outro"
                src="./assets/discovery/references.webp"
                alt=""
              />
              <div className="lexicon-more">
                <h2>{t.more}</h2>
                <p>{t.possibilities}</p>
                <a href={t.url} target="_blank" rel="noreferrer">
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
