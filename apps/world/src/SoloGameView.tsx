import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GameAction, GameError, GameView } from './games-protocol'
import { soloRemaining, SOLO_TARGET } from './solo-game'
import {
  Burst,
  Confetti,
  Countdown,
  Curtain,
  inCountdown,
  PunchNumber,
  SparkleIcon,
  StarIcon,
  usePrevious,
  useTransient,
} from './game-juice'
import { haptic } from './haptics'
import { AnimatePresence, Appear, AppearP, motion, pop, swap } from './game-motion'
import './solo-game.css'

// Reopening a finished run must not replay its victory.
const celebrated = new Set<string>()

export function SoloGameView({
  game,
  now,
  online,
  error,
  titleId,
  send,
  onShake,
}: {
  game: GameView
  now: number
  online: boolean
  error: GameError | null
  titleId: string
  send: (action: GameAction) => boolean
  onShake?: () => void
}) {
  const [draft, setDraft] = useState('')
  // A second tap on "Try again" before the room answers would only earn a false error.
  const [retrying, setRetrying] = useState(false)
  const [sending, setSending] = useState(false)
  // The countdown covers preparation and the server's 3 s before the first question.
  const countKey = `${game.id}:${game.startsAt ?? 'preparing'}`
  const [countDone, setCountDone] = useState('')
  const counting = countDone !== countKey && inCountdown(game.phase, game.round, game.startsAt, now)
  const [curtain, setCurtain] = useState(0)
  const [falling, setFalling] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const shell = useRef<HTMLElement>(null)
  useEffect(() => {
    setDraft('')
    setSending(false)
  }, [game.round])
  useEffect(() => {
    if (game.ownAnswer || error) setSending(false)
  }, [game.ownAnswer, error])
  useEffect(() => {
    setRetrying(false)
  }, [game.ownAnswer?.status, game.round, error])
  useEffect(() => {
    // An old persisted solo may still be waiting on its former reveal screen.
    if (game.phase === 'reveal' && online && !game.solo?.pauses.includes('away'))
      send({ action: 'next' })
  }, [game.phase, game.solo?.pauses, online, send])
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
  const feedback =
    game.phase === 'question' &&
    !game.ownAnswer &&
    game.soloFeedback &&
    now - game.soloFeedback.at < 1400
      ? game.soloFeedback
      : null
  const seconds = Math.ceil(soloRemaining(run, now) / 1000)
  const urgent = question && seconds <= 10 && run.pauses.length === 0

  // Stars: a lit star bursts, a broken streak drops its stars one by one.
  const previousStreak = usePrevious(run.streak)
  const litSeed = `${game.id}:${run.answered}:${run.streak}`
  const justLit = useTransient(litSeed, 900, run.streak > previousStreak)
  const lastStreak = useRef(run.streak)
  useEffect(() => {
    const before = lastStreak.current
    lastStreak.current = run.streak
    if (run.streak < before && before > 0) {
      setFalling(before)
      const timer = setTimeout(() => setFalling(0), 750)
      return () => clearTimeout(timer)
    }
    setFalling(0)
  }, [run.streak])

  // Outcome reactions: the room decides, the interface only reacts.
  const outcomeKey = game.soloFeedback ? `${game.soloFeedback.round}:${game.soloFeedback.status}` : ''
  const flash = useTransient(outcomeKey, 700, Boolean(game.soloFeedback) && !game.ownAnswer)
  const feedbackStatus = game.soloFeedback?.status
  useEffect(() => {
    if (!outcomeKey || game.ownAnswer) return
    if (feedbackStatus === 'wrong') {
      haptic('error')
      onShake?.()
    } else if (feedbackStatus === 'correct') haptic('star')
    else haptic('nudge')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomeKey])
  useEffect(() => {
    if (urgent && seconds <= 5 && seconds > 0) haptic('tick')
  }, [urgent, seconds])
  useEffect(() => {
    if (game.phase !== 'finished' || celebrated.has(game.id)) return
    celebrated.add(game.id)
    if (run.outcome === 'won') {
      setCelebrate(true)
      haptic('win')
      const timer = setTimeout(() => setCelebrate(false), 4200)
      return () => clearTimeout(timer)
    }
    haptic('nudge')
  }, [game.phase, game.id, run.outcome])

  const submit = (text: string) => {
    if (!canAnswer || !text.trim()) return
    if (send({ action: 'answer', gameId: game.id, round: game.round, text })) {
      haptic('select')
      setSending(true)
    }
  }
  // Keep the same input mounted through automatic transitions to retain the mobile keyboard.
  const retry = () => {
    if (retrying) return
    setSending(false)
    if (send({ action: 'next' })) setRetrying(true)
  }
  const stars = [1, 2, 3, 4]
  return (
    <section
      ref={shell}
      className="solo-game"
      data-outcome={run.outcome ?? status}
      data-flash={flash ? feedbackStatus : undefined}
    >
      <Curtain token={curtain} anchor={shell} tone="blue" label="★" />
      {counting && (
        <Countdown
          screen
          anchor={shell}
          steps={['3', '2', '1', choose('Partez !', 'Go!')]}
          until={question ? game.startsAt : undefined}
          now={now}
          paused={blocked}
          onTick={index => haptic(index === 3 ? 'success' : 'tick')}
          onDone={() => {
            setCountDone(countKey)
            setCurtain(n => n + 1)
          }}
        >
          <small role={blocked ? 'status' : undefined}>
            {blocked
              ? choose(
                  'En pause. Ta série et ton temps sont conservés.',
                  'Paused. Your streak and remaining time are saved.'
                )
              : game.phase === 'generating'
                ? choose('Les questions arrivent du catalogue…', 'Questions are on their way…')
                : choose('Quatre bonnes réponses d’affilée !', 'Four correct answers in a row!')}
          </small>
          <button
            type="button"
            className="games-text juice-countdown-leave"
            disabled={!online}
            onClick={() => send({ action: 'leave' })}
          >
            {choose('Quitter le défi', 'Leave challenge')}
          </button>
        </Countdown>
      )}
      {counting ? null : (
      <>
      {celebrate && <Confetti seed={game.id} />}
      <header className="games-header">
        <span className="games-eyebrow">
          {choose('Défi solo · Bible Strong', 'Solo challenge · Bible Strong')}
        </span>
        <h1 id={titleId}>{choose('4 à la suite', 'Four in a row')}</h1>
        <p>
          {choose(
            'Quatre bonnes réponses consécutives avant la fin du chrono.',
            'Four consecutive correct answers before time runs out.'
          )}
        </p>
      </header>
      <div className="solo-scoreboard" data-urgent={urgent}>
        <div
          className="solo-stars"
          aria-label={choose(
            `${run.streak} bonnes réponses sur 4`,
            `${run.streak} correct answers out of 4`
          )}
        >
          {stars.map(n => {
            const lit = n <= run.streak
            const dropping = falling > 0 && n <= falling
            return (
              <span
                key={n}
                data-lit={lit || dropping}
                data-falling={dropping}
                data-fresh={lit && n === run.streak && justLit}
                style={{ '--n': n } as CSSProperties}
                aria-hidden="true"
              >
                <StarIcon />
                {justLit && n === run.streak && (
                  <Burst seed={litSeed} count={n === SOLO_TARGET ? 26 : 14} spread={70} />
                )}
              </span>
            )
          })}
        </div>
        <strong
          key={urgent ? seconds : 'calm'}
          className="solo-clock"
          data-urgent={urgent}
          aria-label={choose('Temps de jeu restant', 'Remaining play time')}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </strong>
        <small>
          {choose('Meilleure série', 'Best streak')} <b>{run.best} / 4</b> ·{' '}
          {choose('Questions jouées', 'Questions played')} {run.answered}
        </small>
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {blocked && (
          <AppearP key="blocked" className="games-notice" role="status">
            Ⅱ{' '}
            {choose(
              'En pause. Ta série et ton temps sont conservés.',
              'Paused. Your streak and remaining time are saved.'
            )}
          </AppearP>
        )}
        {error && (
          <AppearP key="error" className="games-notice games-error" role="alert">
            {error === 'rate_limited'
              ? choose('Patiente un instant, puis réessaie.', 'Wait a moment, then retry.')
              : choose(
                  'Action indisponible. Réessaie après la reconnexion.',
                  'Action unavailable. Try again after reconnecting.'
                )}
          </AppearP>
        )}
      </AnimatePresence>
      {game.phase === 'lobby' && (
        <div className="solo-intro">
          <img
            className="solo-intro-art"
            src="./assets/games/terminal.webp"
            alt=""
            width="160"
            height="160"
          />
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
                  '2 minutes pour réussir. Les questions s’enchaînent ; une erreur remet la série à zéro. Les corrections t’attendent à la fin.',
                  '2 minutes to succeed. Questions follow automatically; a mistake resets your streak. Review the answers at the end.'
                )}
          </p>
          <button
            className="games-primary juice-shine-host"
            disabled={blocked || counting}
            onClick={() => {
              haptic('select')
              send({ action: 'start' })
            }}
          >
            {choose('C’est parti !', 'Let’s play!')}
          </button>
        </div>
      )}
      {game.phase === 'generating' && (
        <p className="games-notice" role="status">
          {choose(
            'De nouvelles questions arrivent… Ton chrono est en pause.',
            'More questions are on their way… Your timer is paused.'
          )}
        </p>
      )}
      {question && (
        <div className="solo-question" data-flash={flash ? feedbackStatus : undefined}>
          <div className="solo-live-feedback" aria-live="polite" aria-atomic="true">
            <AnimatePresence initial={false} mode="popLayout">
              {feedback && (
                <motion.span key={feedback.round} data-status={feedback.status} {...pop}>
                  <i aria-hidden="true">
                    {feedback.status === 'correct' ? '✓' : feedback.status === 'wrong' ? '✕' : '↷'}
                  </i>
                  {feedback.status === 'correct'
                    ? choose('Bonne réponse !', 'Correct!')
                    : feedback.status === 'wrong'
                      ? choose('Série remise à zéro', 'Streak reset')
                      : choose('Question passée · série à zéro', 'Question skipped · streak reset')}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div className="solo-question-text" key={game.round} {...swap}>
              <span className="solo-question-number">
                {choose('Question', 'Question')} {run.answered + 1}
              </span>
              <h2>{game.question}</h2>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence initial={false} mode="popLayout">
          {status === 'pending' && (
            <AppearP key="pending" className="games-notice solo-checking" role="status">
              <span className="solo-loading solo-loading-small" aria-hidden="true">
                <i>
                  <SparkleIcon />
                </i>
                <i>
                  <SparkleIcon />
                </i>
                <i>
                  <SparkleIcon />
                </i>
              </span>
              {choose(
                'Réponse en cours de vérification · chrono en pause',
                'Checking your answer · timer paused'
              )}
            </AppearP>
          )}
          {(status === 'clarify' || status === 'unavailable') && (
            <Appear key="retry" className="games-notice" role="status">
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
              <button className="games-primary" disabled={blocked || retrying} onClick={retry}>
                {choose('Réessayer', 'Try again')}
              </button>
            </Appear>
          )}
          </AnimatePresence>
          {game.choices?.length ? (
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
                readOnly={blocked}
                aria-busy={status === 'pending'}
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
      {game.phase === 'finished' && (
        <>
          <div className="solo-result" role="status" data-outcome={run.outcome}>
            <span className="solo-result-icon juice-bounce-in" aria-hidden="true">
              {run.outcome === 'won' ? '🏆' : '⏱'}
              {run.outcome === 'won' && <Burst seed={`${game.id}:won`} count={22} spread={110} />}
            </span>
            <h2 className="juice-stamp">
              {run.outcome === 'won'
                ? choose('Les 4 étoiles sont à toi !', 'All four stars are yours!')
                : run.outcome === 'timeout'
                  ? choose('Temps écoulé !', 'Time’s up!')
                  : choose('Défi terminé !', 'Challenge completed!')}
            </h2>
            <div className="solo-result-stars" aria-hidden="true">
              {stars.map(n => (
                <span key={n} data-lit={n <= run.best} style={{ '--n': n } as CSSProperties}>
                  <StarIcon />
                </span>
              ))}
            </div>
            <div className="solo-result-stats">
              <div>
                <b>
                  <PunchNumber value={run.best} from={0} duration={700} /> / 4
                </b>
                <small>{choose('Meilleure série', 'Best streak')}</small>
              </div>
              <div>
                <b>
                  <PunchNumber value={run.answered} from={0} duration={900} />
                </b>
                <small>{choose('Questions jouées', 'Questions played')}</small>
              </div>
            </div>
          </div>
          <section
            className="solo-review"
            aria-label={choose('Bilan de ton défi', 'Your challenge review')}
          >
            <h2>
              {choose('Ton parcours, question par question', 'Your run, question by question')}
            </h2>
            {game.soloReviewIncomplete && (
              <p>
                {choose(
                  'Ce bilan reprend les réponses enregistrées depuis la mise à jour du jeu.',
                  'This review includes answers recorded since the game update.'
                )}
              </p>
            )}
            <ol>
              {(game.soloReview ?? []).map((item, index) => (
                <li key={item.round} style={{ '--i': index } as CSSProperties}>
                  <details
                    className="solo-review-item"
                    data-status={item.status}
                    open={item.status === 'wrong'}
                  >
                    <summary>
                      <span className="solo-review-status">
                        {item.status === 'correct'
                          ? choose('✓ Bonne réponse', '✓ Correct')
                          : item.status === 'wrong'
                            ? choose('✕ Mauvaise réponse', '✕ Incorrect')
                            : item.status === 'skipped'
                              ? choose('↷ Question passée', '↷ Skipped')
                              : choose('◷ Temps écoulé', '◷ Time ran out')}
                      </span>
                      <strong>
                        {item.round + 1}. {item.question}
                      </strong>
                    </summary>
                    <div className="solo-review-detail">
                      <p>
                        {choose('Ta réponse', 'Your answer')} :{' '}
                        <strong>{item.text || choose('Aucune réponse', 'No answer')}</strong>
                      </p>
                      <p>
                        {choose('Réponse attendue', 'Expected answer')} :{' '}
                        <strong>{item.answer}</strong>
                      </p>
                      <p>{item.explanation}</p>
                      {item.sources.map((source, index) => (
                        <a
                          key={`${source.url}:${index}`}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.reference} ↗
                        </a>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        </>
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
      </>
      )}
    </section>
  )
}
