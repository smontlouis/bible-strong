import { useState } from 'react'
import { DiscoveryDialog } from './DiscoveryDialog'
import { comparisonsCopy } from './comparisons-discovery-copy'
import './comparisons-discovery.css'

export function ComparisonsDiscovery({
  language,
  onClose,
}: {
  language: 'fr' | 'en'
  onClose: () => void
}) {
  const t = comparisonsCopy[language]
  const [added, setAdded] = useState(false)
  const [highlighted, setHighlighted] = useState(false)
  const [step, setStep] = useState<number | null>(0)
  const cards = (compare: boolean, highlight: boolean) => (
    <div className="comparisons-cards" aria-live="polite">
      {t.versions.slice(0, compare ? 2 : 1).map(version => (
        <article key={version.code} className="comparisons-card">
          <div className="comparisons-version">
            <strong>{version.code}</strong>
            <span>{version.name}</span>
          </div>
          <small>{t.reference}</small>
          <p>
            {version.before}
            <mark className={highlight ? 'is-lit' : ''}>{version.focus}</mark>
            {version.after}
          </p>
        </article>
      ))}
    </div>
  )
  return (
    <DiscoveryDialog
      copy={t}
      icon={<span aria-hidden="true">⇄</span>}
      className="comparisons-dialog"
      onClose={onClose}
    >
      {slide => (
        <>
          {slide === 0 && (
            <>
              <img
                className="lexicon-illustration"
                src="./assets/discovery/comparisons.webp"
                alt={t.illustration}
              />
              {cards(added, false)}
              <button
                className="comparisons-action"
                aria-expanded={added}
                onClick={() => setAdded(value => !value)}
              >
                <span aria-hidden="true">{added ? '−' : '+'}</span>
                {added ? t.remove : t.add}
              </button>
              {added && <p className="comparisons-note">{t.hint}</p>}
            </>
          )}
          {slide === 1 && (
            <>
              {cards(true, highlighted)}
              <button
                className="comparisons-action"
                aria-pressed={highlighted}
                onClick={() => setHighlighted(value => !value)}
              >
                <span aria-hidden="true">✦</span>
                {highlighted ? t.clear : t.highlight}
              </button>
              {highlighted && (
                <p className="comparisons-insight" aria-live="polite">
                  {t.insight}
                </p>
              )}
            </>
          )}
          {slide === 2 && (
            <>
              <div className="comparisons-path">
                {t.steps.map((item, index) => (
                  <button
                    key={item.title}
                    aria-expanded={step === index}
                    onClick={() => setStep(step === index ? null : index)}
                  >
                    <span className="comparisons-step-title">
                      <span>{index + 1}</span>
                      <strong>{item.title}</strong>
                      <span>{step === index ? '−' : '+'}</span>
                    </span>
                    {step === index && <p>{item.text}</p>}
                  </button>
                ))}
              </div>
              <div className="lexicon-more">
                <h2>{t.more}</h2>
                <p>{t.possibilities}</p>
                <a
                  href="https://web.bible-strong.app/bible-compare-verses?selectedVerses=%7B%2243-1-5%22%3Atrue%7D"
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
