import { useEffect, useState } from 'react'
import type { GameAction, GameError, GameView } from './games-protocol'
import { soloRemaining } from './solo-game'
import './solo-game.css'

export function SoloGameView({
  game,
  now,
  online,
  error,
  titleId,
  send,
}: {
  game: GameView
  now: number
  online: boolean
  error: GameError | null
  titleId: string
  send: (action: GameAction) => boolean
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (!sending) return
    const timer = setTimeout(() => setSending(false), 5000)
    return () => clearTimeout(timer)
  }, [sending])
  const fr = game.options.language === 'fr'
  const run = game.solo!
  const choose = (frText: string, enText: string) => (fr ? frText : enText)
  const status = game.ownAnswer?.status
  const blocked = !online || run.pauses.includes('away')
  const question = game.phase === 'question'
  const canAnswer = question && !blocked && run.pauses.length === 0 && !sending
  const seconds = Math.ceil(soloRemaining(run, now) / 1000)
  const submit = (text: string) => {
    if (!canAnswer || !text.trim()) return
    if (send({ action: 'answer', gameId: game.id, round: game.round, text })) setSending(true)
  }
  // Remount the answer form at each authoritative transition, not when the clock ticks.
  const retry = () => {
    setSending(false)
    send({ action: 'next' })
  }
  return (
    <section className="solo-game" data-outcome={run.outcome ?? status}>
      <header className="games-header">
        <span className="games-eyebrow">
          {choose('Défi solo · Bible Strong', 'Solo challenge · Bible Strong')}
        </span>
        <h1 id={titleId}>{choose('4 à la suite', 'Four in a row')}</h1>
        <p>
          {choose(
            'Quatre bonnes réponses consécutives. À ton rythme entre les questions.',
            'Four consecutive correct answers. Take your time between questions.'
          )}
        </p>
      </header>
      <div className="solo-scoreboard">
        <div
          className="solo-stars"
          aria-label={choose(
            `${run.streak} bonnes réponses sur 4`,
            `${run.streak} correct answers out of 4`
          )}
        >
          {[1, 2, 3, 4].map(n => (
            <span key={n} data-lit={n <= run.streak} aria-hidden="true">
              ★
            </span>
          ))}
        </div>
        <strong
          className="solo-clock"
          data-urgent={seconds <= 15}
          aria-label={choose('Temps de jeu restant', 'Remaining play time')}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </strong>
        <small>
          {choose('Meilleure série', 'Best streak')} <b>{run.best} / 4</b> ·{' '}
          {choose('Questions jouées', 'Questions played')} {run.answered}
        </small>
      </div>
      {blocked && (
        <p className="games-notice" role="status">
          Ⅱ{' '}
          {choose(
            'En pause. Ta série et ton temps sont conservés.',
            'Paused. Your streak and remaining time are saved.'
          )}
        </p>
      )}
      {error && (
        <p className="games-notice games-error" role="alert">
          {error === 'rate_limited'
            ? choose(
                'Patiente un instant, puis réessaie. Ton chrono est suspendu.',
                'Wait a moment, then retry. Your timer is paused.'
              )
            : choose(
                'Action indisponible. Réessaie après la reconnexion.',
                'Action unavailable. Try again after reconnecting.'
              )}
        </p>
      )}
      {game.phase === 'lobby' && (
        <div className="solo-intro">
          <img src="./assets/games/terminal.webp" alt="" width="160" height="160" />
          <h2>
            {game.reason
              ? choose('On réessaie ?', 'Try again?')
              : choose('Prêt à allumer les 4 étoiles ?', 'Ready to light all four stars?')}
          </h2>
          <p>
            {game.reason
              ? choose(
                  'La préparation a échoué. Ta progression est conservée.',
                  'Preparation failed. Your progress is saved.'
                )
              : choose(
                  '2 minutes de jeu effectif. Une erreur remet la série à zéro. Le chrono s’arrête pendant les explications et les vérifications.',
                  '2 minutes of active play. A mistake resets your streak. The timer stops during explanations and answer checks.'
                )}
          </p>
          <button
            className="games-primary"
            disabled={blocked}
            onClick={() => send({ action: 'start' })}
          >
            {choose('C’est parti !', 'Let’s play!')}
          </button>
        </div>
      )}
      {game.phase === 'generating' && (
        <div className="solo-intro" role="status">
          <span className="solo-loading" aria-hidden="true">
            ✦
          </span>
          <h2>
            {choose('La prochaine aventure se prépare…', 'Your next adventure is being prepared…')}
          </h2>
          <p>
            {choose(
              'Gloo recherche les questions bibliques. Ton chrono reste en pause.',
              'Gloo is researching Bible questions. Your timer remains paused.'
            )}
          </p>
        </div>
      )}
      {question && (
        <div className="solo-question">
          <h2>{game.question}</h2>
          {status === 'pending' && (
            <p className="games-notice" role="status">
              ✦{' '}
              {choose(
                'Réponse en cours de vérification · chrono en pause',
                'Checking your answer · timer paused'
              )}
            </p>
          )}
          {(status === 'clarify' || status === 'unavailable') && (
            <div className="games-notice" role="status">
              <p>
                {status === 'clarify'
                  ? choose(
                      'Précise ta réponse. Ta série est conservée.',
                      'Be more specific. Your streak is safe.'
                    )
                  : choose(
                      'La vérification a échoué. Aucune pénalité.',
                      'Answer checking failed. No penalty.'
                    )}
              </p>
              <button className="games-primary" disabled={blocked} onClick={retry}>
                {choose('Réessayer', 'Try again')}
              </button>
            </div>
          )}
          {game.choices ? (
            <div className="games-choices">
              {game.choices.map((text, i) => (
                <button
                  className="games-choice"
                  key={text}
                  disabled={!canAnswer}
                  onClick={() => submit(text)}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {text}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="games-answer-form"
              onSubmit={event => {
                event.preventDefault()
                submit(draft)
              }}
            >
              <label htmlFor={`${titleId}-answer`}>{choose('Ta réponse', 'Your answer')}</label>
              <input
                id={`${titleId}-answer`}
                value={draft}
                maxLength={160}
                autoComplete="off"
                disabled={!canAnswer}
                onChange={event => setDraft(event.target.value)}
              />
              <button className="games-primary" disabled={!canAnswer || !draft.trim()}>
                {choose('Valider', 'Answer')} →
              </button>
            </form>
          )}
        </div>
      )}
      {question && (
        <button
          className="games-secondary"
          disabled={!canAnswer}
          onClick={() => send({ action: 'pass', gameId: game.id, round: game.round })}
        >
          {choose('Passer cette question', 'Skip this question')}
        </button>
      )}
      {(game.phase === 'reveal' || game.phase === 'finished') && (
        <div className="solo-result" role="status">
          <span className="solo-result-icon" aria-hidden="true">
            {run.outcome === 'won' ? '🏆' : status === 'correct' ? '★' : '↻'}
          </span>
          <h2>
            {run.outcome === 'won'
              ? choose('Les 4 étoiles sont à toi !', 'All four stars are yours!')
              : run.outcome === 'timeout'
                ? choose('Temps écoulé !', 'Time’s up!')
                : run.outcome === 'exhausted'
                  ? choose('Défi terminé !', 'Challenge completed!')
                  : status === 'correct'
                    ? choose('Bien joué !', 'Well done!')
                    : choose('Une nouvelle série commence !', 'A new streak starts here!')}
          </h2>
          {game.result && (
            <>
              <strong>{game.result.answer}</strong>
              <p>{game.result.explanation}</p>
              <a href={game.result.url} target="_blank" rel="noreferrer">
                {game.result.reference} ↗
              </a>
            </>
          )}
          {game.phase === 'reveal' && (
            <button className="games-primary" disabled={blocked} onClick={retry}>
              {choose('Question suivante', 'Next question')} →
            </button>
          )}
        </div>
      )}
      <footer className="games-actions">
        <button
          className="games-secondary"
          onClick={() => send({ action: 'leave' })}
          disabled={!online}
        >
          {game.phase === 'finished'
            ? choose('Retour aux jeux', 'Back to games')
            : choose('Quitter le défi', 'Leave challenge')}
        </button>
      </footer>
    </section>
  )
}
