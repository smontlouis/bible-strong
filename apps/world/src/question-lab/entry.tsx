import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { batches, catalogue } from './catalogue'
import {
  type Language,
  type Reviews,
  type Review,
  nextQuestion,
  exactAnswer,
  referenceLabel,
} from './model'
import './style.css'

const KEY = 'bible-strong-question-review-v1'
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}
function App() {
  const [language, setLanguage] = useState<Language>('fr')
  const t = (fr: string, en: string) => (language === 'fr' ? fr : en)
  const [difficulty, setDifficulty] = useState('all')
  const [testament, setTestament] = useState('all')
  const [batch, setBatch] = useState(() => {
    const requested = new URLSearchParams(location.search).get('batch')
    return requested && batches.includes(Number(requested)) ? requested : 'all'
  })
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [reviews, setReviews] = useState<Reviews>(() => read(KEY, {}))
  const [storageError, setStorageError] = useState(false)
  const [selected, setSelected] = useState(catalogue[0].id)
  const [bilingual, setBilingual] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [player, setPlayer] = useState('1')
  const [seen, setSeen] = useState<Record<string, string[]>>(() => read(KEY + '-seen', {}))
  const [playId, setPlayId] = useState<string>()
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [streak, setStreak] = useState(0)
  const [scored, setScored] = useState(false)
  const [matched, setMatched] = useState(false)
  const filtered = catalogue.filter(
    q =>
      (batch === 'all' || q.batch === Number(batch)) &&
      (difficulty === 'all' || q.difficulty === difficulty) &&
      (testament === 'all' || q.testament === testament) &&
      (status === 'all' || (reviews[q.id]?.status || 'pending') === status) &&
      (!search ||
        `${q.id} ${q.fr.question} ${q.en.question} ${q.fr.answer} ${q.en.answer}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  )
  const q = playing
    ? catalogue.find(q => q.id === playId)
    : filtered.find(q => q.id === selected) || filtered[0]
  const review = q ? reviews[q.id] || { status: 'pending', note: '' } : null
  function persist(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }
  function updateReview(patch: Partial<Review>) {
    if (!q || !review) return
    const next = { ...reviews, [q.id]: { ...review, ...patch } }
    setReviews(next)
    persist(KEY, next)
  }
  function draw() {
    const next = nextQuestion(filtered, seen[player] || [])
    if (!next) return
    const history = {
      ...seen,
      [player]: [...(seen[player] || []).filter(id => id !== next.id), next.id],
    }
    setSeen(history)
    persist(KEY + '-seen', history)
    setPlayId(next.id)
    setDraft('')
    setRevealed(false)
    setScored(false)
    setMatched(false)
  }
  function score(correct: boolean) {
    if (!scored) {
      setStreak(n => (correct ? n + 1 : 0))
      setScored(true)
    }
  }
  function exportReview() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            questions: catalogue.map(q => ({
              ...q,
              review: reviews[q.id] || { status: 'pending', note: '' },
            })),
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bible-strong-questions-review.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const levels = [
    ['easy', t('Découverte', 'Discovery')],
    ['medium', t('Intermédiaire', 'Intermediate')],
    ['hard', t('Avancé', 'Advanced')],
  ]
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">
            BIBLE STRONG · {t('ATELIER DES QUESTIONS', 'QUESTION WORKSHOP')}
          </span>
          <h1>{t('De belles questions. Sans attendre.', 'Good questions. No waiting.')}</h1>
          <p>
            {t(
              `${catalogue.length} questions · 3 niveaux · Ancien et Nouveau Testament · FR / EN`,
              `${catalogue.length} questions · 3 levels · Old and New Testament · FR / EN`
            )}
          </p>
        </div>
        <div className="toolbar">
          <button
            className="games-secondary"
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          >
            {language === 'fr' ? 'English' : 'Français'}
          </button>
          <button className="games-primary" onClick={exportReview}>
            {t('Exporter la revue', 'Export review')} ↓
          </button>
        </div>
      </header>
      <div className="notice">
        {t(
          'Prototype éditorial — questions à relire avant publication. Tes validations et notes sont enregistrées dans ce navigateur.',
          'Editorial prototype — review questions before publication. Your decisions and notes are saved in this browser.'
        )}
      </div>
      {storageError && (
        <p role="alert">
          {t(
            'Sauvegarde locale indisponible. Exporte ta revue avant de fermer.',
            'Local storage unavailable. Export your review before closing.'
          )}
        </p>
      )}
      <section className="stats">
        {levels.map(([key, label]) => (
          <button
            className="stat games-secondary"
            key={key}
            onClick={() => {
              setDifficulty(key)
              setPlaying(false)
            }}
          >
            <strong>{label}</strong>
            <span>
              {catalogue.filter(q => q.difficulty === key && q.testament === 'old').length}{' '}
              {t('Ancien', 'Old')} ·{' '}
              {catalogue.filter(q => q.difficulty === key && q.testament === 'new').length}{' '}
              {t('Nouveau', 'New')}
            </span>
          </button>
        ))}
        <div className="stat progress">
          <strong>
            {Object.values(reviews).filter(r => r.status === 'approved').length} /{' '}
            {catalogue.length}
          </strong>
          <span>{t('questions validées', 'approved questions')}</span>
        </div>
      </section>
      <nav>
        <button
          className={playing ? 'games-secondary' : 'games-primary'}
          onClick={() => setPlaying(false)}
        >
          {t('Relire le catalogue', 'Review catalogue')}
        </button>
        <button
          className={playing ? 'games-primary' : 'games-secondary'}
          disabled={!filtered.length}
          onClick={() => {
            setPlaying(true)
            setStreak(0)
            draw()
          }}
        >
          {t('Essayer une série', 'Try a round')} ★
        </button>
      </nav>
      <section className="filters">
        <label>
          {t('Lot', 'Batch')}
          <select value={batch} disabled={playing} onChange={e => setBatch(e.target.value)}>
            <option value="all">{t('Tous les lots', 'All batches')}</option>
            {batches.map(number => (
              <option key={number} value={number}>
                {t('Lot', 'Batch')} {number}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Niveau', 'Level')}
          <select
            value={difficulty}
            disabled={playing}
            onChange={e => setDifficulty(e.target.value)}
          >
            <option value="all">{t('Tous les niveaux', 'All levels')}</option>
            {levels.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Testament
          <select value={testament} disabled={playing} onChange={e => setTestament(e.target.value)}>
            <option value="all">{t('Toute la Bible', 'Whole Bible')}</option>
            <option value="old">{t('Ancien Testament', 'Old Testament')}</option>
            <option value="new">{t('Nouveau Testament', 'New Testament')}</option>
          </select>
        </label>
        <label>
          {t('Relecture', 'Review')}
          <select disabled={playing} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">{t('Tous les statuts', 'All statuses')}</option>
            <option value="pending">{t('À relire', 'Pending')}</option>
            <option value="approved">{t('Validée', 'Approved')}</option>
            <option value="revise">{t('À corriger', 'Needs revision')}</option>
          </select>
        </label>
        <label>
          {t('Rechercher', 'Search')}
          <input
            disabled={playing}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Question, réponse, identifiant…', 'Question, answer, ID…')}
          />
        </label>
      </section>
      {playing && (
        <div className="playbar">
          <label>
            {t('Profil de test', 'Test profile')}{' '}
            <select
              value={player}
              onChange={e => {
                setPlayer(e.target.value)
                setPlaying(false)
              }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <strong>
            {'★'.repeat(Math.min(streak, 4))}
            {'☆'.repeat(Math.max(0, 4 - streak))} ·{' '}
            {streak >= 4 ? t('Quatre à la suite !', 'Four in a row!') : `${streak} / 4`}
          </strong>
          <small>
            {t(
              'Questions inédites en priorité ; les plus anciennes reviennent une fois le stock épuisé.',
              'Unseen questions first; oldest questions return once the pool is exhausted.'
            )}
          </small>
        </div>
      )}
      <div className={playing ? 'layout playing' : 'layout'}>
        {!playing && (
          <aside>
            <div className="list-head">
              {filtered.length} {t('questions', 'questions')}
              <label>
                <input
                  type="checkbox"
                  checked={bilingual}
                  onChange={e => setBilingual(e.target.checked)}
                />{' '}
                FR + EN
              </label>
            </div>
            <div className="list">
              {filtered.map(item => (
                <button
                  className="list-item"
                  data-active={q?.id === item.id}
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                >
                  <small>
                    {item.id} ·{' '}
                    {reviews[item.id]?.status === 'approved'
                      ? '✓'
                      : reviews[item.id]?.status === 'revise'
                        ? '!'
                        : '○'}
                  </small>
                  <span>{item[language].question}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
        <article>
          {!q ? (
            <p>
              {t(
                'Aucune question ne correspond à ces filtres.',
                'No questions match these filters.'
              )}
            </p>
          ) : (
            <>
              <div className="question-meta">
                <span>
                  {q.id} · {t('Lot', 'Batch')} {q.batch}
                </span>
                <span>
                  {levels.find(([key]) => key === q.difficulty)?.[1]} ·{' '}
                  {q.testament === 'old'
                    ? t('Ancien Testament', 'Old Testament')
                    : t('Nouveau Testament', 'New Testament')}
                </span>
              </div>
              <div className={!playing && bilingual ? 'translations' : ''}>
                {((!playing && bilingual ? ['fr', 'en'] : [language]) as Language[]).map(lang => (
                  <section key={lang} className="translation">
                    <span className="eyebrow">{lang.toUpperCase()}</span>
                    <h2>{q[lang].question}</h2>
                    {(!playing || revealed) && (
                      <>
                        <div className="answer">
                          <small>{t('Réponse attendue', 'Expected answer')}</small>
                          <strong>{q[lang].answer}</strong>
                        </div>
                        <p>{q[lang].explanation}</p>
                        <p className="aliases">
                          {t('Variantes', 'Aliases')} : {q[lang].aliases.join(', ') || '—'}
                        </p>
                        <a
                          href={`https://web.bible-strong.app/bible-view?book=${q.reference.book}&chapter=${q.reference.chapter}&verse=${q.reference.verse}&version=${lang === 'fr' ? 'LSG' : 'KJV'}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {referenceLabel(q, lang)} ↗
                        </a>
                      </>
                    )}
                  </section>
                ))}
              </div>
              {playing && !revealed && (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    const yes = exactAnswer(q, language, draft)
                    setMatched(yes)
                    setRevealed(true)
                    if (yes) score(true)
                  }}
                >
                  <label>
                    {t('Ta réponse', 'Your answer')}
                    <input
                      autoComplete="off"
                      autoFocus
                      maxLength={160}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                    />
                  </label>
                  <button className="games-primary" disabled={!draft.trim()}>
                    {t('Valider', 'Submit')} →
                  </button>
                  <button
                    type="button"
                    className="games-secondary"
                    onClick={() => {
                      setRevealed(true)
                      score(false)
                    }}
                  >
                    {t('Passer', 'Skip')}
                  </button>
                </form>
              )}
              {playing && revealed && (
                <div className="feedback" role="status">
                  <p>
                    {matched
                      ? t('Bonne réponse !', 'Correct!')
                      : t(
                          'Prototype : compare ta réponse. Jev n’est pas appelé ici.',
                          'Prototype: compare your answer. Jev is not called here.'
                        )}
                  </p>
                  {!scored && (
                    <div className="toolbar">
                      <button className="games-primary" onClick={() => score(true)}>
                        {t('Ma réponse est correcte', 'My answer is correct')}
                      </button>
                      <button className="games-secondary" onClick={() => score(false)}>
                        {t('Réponse incorrecte', 'Incorrect answer')}
                      </button>
                    </div>
                  )}
                  <button
                    className="games-primary"
                    disabled={!scored || streak >= 4}
                    onClick={draw}
                  >
                    {t('Question suivante', 'Next question')} →
                  </button>
                </div>
              )}
              {!playing && review && (
                <footer>
                  <a href={q.sourceUrl} target="_blank" rel="noreferrer">
                    {t('Consulter la source', 'Open source')} ↗
                  </a>
                  <label>
                    {t(
                      'Note de relecture (FR / EN, ambiguïté, niveau…)',
                      'Review note (FR / EN, ambiguity, level…)'
                    )}
                    <textarea
                      value={review.note}
                      onChange={e => updateReview({ note: e.target.value })}
                    />
                  </label>
                  <div className="toolbar">
                    {(['approved', 'revise', 'pending'] as const).map((v, i) => (
                      <button
                        aria-pressed={review.status === v}
                        className={review.status === v ? 'games-primary' : 'games-secondary'}
                        key={v}
                        onClick={() => updateReview({ status: v })}
                      >
                        {
                          [
                            t('Valider', 'Approve'),
                            t('À corriger', 'Needs revision'),
                            t('À relire', 'Pending'),
                          ][i]
                        }
                      </button>
                    ))}
                  </div>
                </footer>
              )}
            </>
          )}
        </article>
      </div>
    </main>
  )
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<App />)
