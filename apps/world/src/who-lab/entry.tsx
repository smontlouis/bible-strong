import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { identities, reviewBatches, type Identity } from './catalogue'
import { normalize, referenceLabel, type Language, type Reviews } from '../question-lab/model'
import '../question-lab/style.css'
import './style.css'
const KEY = 'bible-strong-who-review-v1'
function load(): Reviews {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}
function Round({ q, language, review }: { q: Identity; language: Language; review: boolean }) {
  const [visible, setVisible] = useState(1)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<'correct' | 'unknown' | 'revealed' | null>(null)
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en)
  const copy = q[language]
  const done = result === 'correct' || result === 'revealed'
  return (
    <>
      <div className="who-score" aria-live="polite">
        {review
          ? t('Relecture des quatre indices', 'Review all four clues')
          : done
            ? result === 'correct'
              ? t(
                  `Trouvé ! ${5 - visible} point${visible === 4 ? '' : 's'}`,
                  `Correct! ${5 - visible} point${visible === 4 ? '' : 's'}`
                )
              : t('Réponse dévoilée · 0 point', 'Answer revealed · 0 points')
            : t(
                `${5 - visible} point${visible === 4 ? '' : 's'} à gagner`,
                `${5 - visible} point${visible === 4 ? '' : 's'} available`
              )}
      </div>
      {(review ? q.clues : q.clues.slice(0, visible)).map(clue => (
        <section className="who-clue" key={clue.points}>
          <strong className="who-points">{clue.points}</strong>
          <div>
            <p>{clue[language]}</p>
            {review && <p className="who-translation">{clue[language === 'fr' ? 'en' : 'fr']}</p>}
            {(review || done) && (
              <a href={clue.sourceUrl} target="_blank" rel="noreferrer">
                {referenceLabel({ reference: clue.reference }, language)}
              </a>
            )}
          </div>
        </section>
      ))}
      {!review && !done && (
        <form
          onSubmit={e => {
            e.preventDefault()
            setResult(
              [copy.answer, ...copy.aliases].some(x => normalize(x) === normalize(answer))
                ? 'correct'
                : 'unknown'
            )
          }}
        >
          <label>
            {t('Ta réponse', 'Your answer')}
            <input value={answer} onChange={e => setAnswer(e.target.value)} autoComplete="off" />
          </label>
          <div className="toolbar">
            <button className="games-primary" disabled={!answer.trim()}>
              {t('Répondre', 'Answer')}
            </button>
            <button
              type="button"
              className="games-secondary"
              disabled={visible === 4}
              onClick={() => {
                setVisible(v => v + 1)
                setResult(null)
              }}
            >
              {t('Indice suivant', 'Next clue')}
            </button>
            <button type="button" className="games-secondary" onClick={() => setResult('revealed')}>
              {t('Voir la réponse', 'Reveal answer')}
            </button>
          </div>
          {result === 'unknown' && (
            <p role="status">
              {t(
                'Réponse non reconnue par les variantes locales. Tu peux réessayer ou dévoiler la réponse.',
                'Answer not recognized by local aliases. Try again or reveal the answer.'
              )}
            </p>
          )}
        </form>
      )}
      {(review || done) && (
        <section className="notice">
          <h2>{copy.answer}</h2>
          <p>{copy.explanation}</p>
          {review && (
            <>
              <p>
                {q[language === 'fr' ? 'en' : 'fr'].answer} —{' '}
                {q[language === 'fr' ? 'en' : 'fr'].explanation}
              </p>
              <p>
                FR : {[q.fr.answer, ...q.fr.aliases].join(' · ')}
                <br />
                EN : {[q.en.answer, ...q.en.aliases].join(' · ')}
              </p>
            </>
          )}
        </section>
      )}
      {!review && (
        <p className="who-translation">
          {t(
            'Aperçu sans chrono ni adversaire. Correction locale par variantes, sans Jev.',
            'Preview without timer or opponent. Local alias matching, without Jev.'
          )}
        </p>
      )}
    </>
  )
}
function App() {
  const [language, setLanguage] = useState<Language>('fr')
  const [category, setCategory] = useState('all')
  const [batch, setBatch] = useState(() => {
    const value = new URLSearchParams(location.search).get('batch')
    return value && reviewBatches.includes(Number(value)) ? value : 'all'
  })
  const [selected, setSelected] = useState('')
  const [review, setReview] = useState(false)
  const [run, setRun] = useState(0)
  const [reviews, setReviews] = useState<Reviews>(load)
  const [error, setError] = useState(false)
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en)
  const label = (category: string) =>
    category === 'person'
      ? t('Personnage', 'Person')
      : category === 'place'
        ? t('Lieu', 'Place')
        : t('Objet', 'Object')
  const filtered = identities.filter(
    q =>
      (category === 'all' || q.category === category) &&
      (batch === 'all' || q.batch === Number(batch))
  )
  const q = filtered.find(q => q.id === selected) || filtered[0]
  const saved = q ? reviews[q.id] || { status: 'pending', note: '' } : null
  function save(change: Partial<Reviews[string]>) {
    if (!q || !saved) return
    const next = { ...reviews, [q.id]: { ...saved, ...change } }
    setReviews(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      setError(false)
    } catch {
      setError(true)
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            identities.map(q => ({
              ...q,
              review: reviews[q.id] || { status: 'pending', note: '' },
            })),
            null,
            2
          ),
        ],
        { type: 'application/json' }
      )
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'who-review.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">BIBLE STRONG · {t('ATELIER DES INDICES', 'CLUE WORKSHOP')}</div>
          <h1>{t('Qui suis-je ?', 'Who am I?')}</h1>
          <p>
            {identities.length}{' '}
            {t(
              'fiches FR/EN · personnages, lieux et objets · 4 → 3 → 2 → 1',
              'FR/EN cards · people, places and objects · 4 → 3 → 2 → 1'
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            className="games-secondary"
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          >
            {t('English', 'Français')}
          </button>
          <button className="games-primary" onClick={download}>
            {t('Exporter la revue', 'Export review')}
          </button>
        </div>
      </header>
      <div className="notice">
        {t(
          'Prototype éditorial : indices à relire avant publication. Les notes et validations restent dans ce navigateur.',
          'Editorial prototype: review clues before publication. Notes and decisions remain in this browser.'
        )}
      </div>
      {error && (
        <p role="alert">
          {t(
            'Sauvegarde locale impossible. Exporte la revue avant de quitter.',
            'Local save failed. Export your review before leaving.'
          )}
        </p>
      )}
      <nav>
        <a href="/question-lab.html">← {t('Questions classiques', 'Standard questions')}</a>
        <button
          className={review ? 'games-secondary' : 'games-primary'}
          onClick={() => {
            setReview(false)
            setRun(r => r + 1)
          }}
        >
          {t('Tester les indices', 'Try the clues')}
        </button>
        <button
          className={review ? 'games-primary' : 'games-secondary'}
          onClick={() => setReview(true)}
        >
          {t('Relire FR + EN', 'Review FR + EN')}
        </button>
      </nav>
      <label className="who-filter">
        {t('Lot de relecture', 'Review batch')}
        <select value={batch} onChange={e => setBatch(e.target.value)}>
          <option value="all">{t('Tous les lots', 'All batches')}</option>
          {reviewBatches.map(n => (
            <option key={n} value={n}>
              {t('Lot', 'Batch')} {n}
            </option>
          ))}
        </select>
      </label>
      <label className="who-filter">
        {t('Catégorie de relecture', 'Review category')}
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">{t('Toutes', 'All')}</option>
          {['person', 'place', 'object'].map(c => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </label>
      <div className="layout">
        <aside>
          <div className="list-head">
            {filtered.length} {t('fiches', 'cards')}
          </div>
          <div className="list">
            {filtered.map(card => (
              <button
                key={card.id}
                className="list-item"
                data-active={q?.id === card.id}
                onClick={() => {
                  setSelected(card.id)
                  setRun(r => r + 1)
                }}
              >
                <span>
                  {card.id} · {label(card.category)}
                </span>
                <strong>
                  {review
                    ? card[language].answer
                    : t('Identité à découvrir', 'Identity to discover')}
                </strong>
              </button>
            ))}
          </div>
        </aside>
        <article className="who-card">
          {q ? (
            <>
              <div className="toolbar">
                <strong>{label(q.category)}</strong>
                <span>{q.id}</span>
                <button className="games-secondary" onClick={() => setRun(r => r + 1)}>
                  {t('Recommencer', 'Restart')}
                </button>
              </div>
              <Round
                key={`${q.id}-${review}-${run}-${language}`}
                q={q}
                language={language}
                review={review}
              />
              {review && saved && (
                <footer>
                  <label>
                    {t('Note de relecture', 'Review note')}
                    <textarea value={saved.note} onChange={e => save({ note: e.target.value })} />
                  </label>
                  <label>
                    {t('Statut', 'Status')}
                    <select
                      value={saved.status}
                      onChange={e => save({ status: e.target.value as Reviews[string]['status'] })}
                    >
                      <option value="pending">{t('À relire', 'Pending')}</option>
                      <option value="approved">{t('Validée', 'Approved')}</option>
                      <option value="revise">{t('À corriger', 'Needs revision')}</option>
                    </select>
                  </label>
                </footer>
              )}
            </>
          ) : (
            <p>{t('Aucune fiche disponible.', 'No cards available.')}</p>
          )}
        </article>
      </div>
    </main>
  )
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<App />)
