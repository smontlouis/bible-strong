import { useEffect, useId, useState, type CSSProperties } from 'react'
import { AvatarPreview } from './AvatarEditor'
import { GameScore } from './GameFeedback'
import { turnPresentation } from './game-presentation'
import { WHO_ZONE_MS, type GameView } from './games-protocol'

const copy = {
  fr: {
    duel: 'FACE À FACE',
    race: 'LA COURSE AUX INDICES',
    points: 'points',
    point: 'point',
    ready: 'À toi',
    active: 'À la main',
    eligible: 'Peut répondre',
    waiting: 'Patiente',
    blocked: 'Prochain indice',
    checking: 'Vérification…',
    absent: 'Reconnexion…',
    you: 'Toi',
    clue: 'Indice',
    previous: 'Les indices précédents',
    answer: 'Ta réponse',
    placeholder: 'Un personnage, un lieu, un objet…',
    submit: 'Envoyer',
    prepare: 'Tu peux déjà préparer ta réponse.',
    wrong: 'Ce n’est pas la bonne réponse. Tu pourras rejouer au prochain indice.',
    hand: 'La main est passée à l’autre joueur.',
    clarify: 'Précise ta réponse : de qui ou de quoi parles-tu ?',
    exhausted: 'Tes essais pour cet indice sont terminés.',
    paused: 'Partie en pause',
    checkingClock: 'Réponse en cours de vérification · chrono suspendu',
    duelRule: 'Une mauvaise réponse passe la main. Le premier qui trouve gagne la manche.',
    raceRule: 'Une tentative par indice. La première bonne réponse gagne la manche.',
  },
  en: {
    duel: 'FACE TO FACE',
    race: 'THE CLUE RACE',
    points: 'points',
    point: 'point',
    ready: 'You',
    active: 'Their turn',
    eligible: 'Can answer',
    waiting: 'Waiting',
    blocked: 'Next clue',
    checking: 'Checking…',
    absent: 'Reconnecting…',
    you: 'You',
    clue: 'Clue',
    previous: 'Previous clues',
    answer: 'Your answer',
    placeholder: 'A person, place or object…',
    submit: 'Send',
    prepare: 'You can prepare your answer now.',
    wrong: 'That is not the answer. Try again at the next clue.',
    hand: 'The other player now has the turn.',
    clarify: 'Be more specific: who or what do you mean?',
    exhausted: 'You have used your attempts for this clue.',
    paused: 'Game paused',
    checkingClock: 'Checking the answer · clock paused',
    duelRule: 'A wrong answer passes the turn. The first correct answer wins the round.',
    raceRule: 'One attempt per clue. The first correct answer wins the round.',
  },
}

export function WhoPlayers({ game, me }: { game: GameView; me: string | null }) {
  const w = game.who!
  const t = copy[game.options.language]
  return (
    <div
      className="who-contestants"
      data-mode={w.mode}
      aria-label={w.mode === 'duel' ? t.duel : t.race}
    >
      {game.players.map(p => {
        const checking = w.checking.includes(p.id)
        const ready = w.eligible.includes(p.id) && game.pausedAt === null
        const winner = w.winner === p.id && !game.result?.void
        return (
          <div
            className="who-contestant"
            key={p.id}
            data-active={ready && game.phase === 'question'}
            data-winner={winner}
            data-me={p.id === me}
            data-checking={checking}
            data-absent={p.absentSince !== null}
          >
            <div className="who-portrait">
              <AvatarPreview avatar={p.profile.avatar} color={p.profile.color} />
              <span className="who-score" aria-label={`${p.score} ${t.points}`}>
                <GameScore value={p.score} />
              </span>
            </div>
            <strong>
              {p.profile.name}
              {p.id === me ? ` · ${t.you}` : ''}
            </strong>
            <span className="who-player-state">
              {p.absentSince !== null
                ? t.absent
                : game.pausedAt !== null
                  ? t.paused
                  : winner
                    ? `✦ +${w.awarded}`
                    : game.phase !== 'question'
                      ? t.points
                      : checking
                        ? t.checking
                        : ready
                          ? p.id === me
                            ? t.ready
                            : w.mode === 'duel'
                              ? t.active
                              : t.eligible
                          : w.mode === 'race'
                            ? t.blocked
                            : t.waiting}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function WhoRound({
  game,
  me,
  online,
  now,
  onAnswer,
}: {
  game: GameView
  me: string | null
  online: boolean
  now: number
  onAnswer: (text: string, zone: number) => boolean
}) {
  const w = game.who!
  const t = copy[game.options.language]
  const inputId = useId()
  const [text, setText] = useState(game.ownAnswer?.text ?? '')
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => {
    if (sent === null) return
    const timer = setTimeout(() => setSent(null), 5000)
    return () => clearTimeout(timer)
  }, [sent])
  // A snapshot acknowledgement unlocks the local network-flight guard. The input stays editable.
  const acknowledgement = `${w.zone}:${game.ownAnswer?.status}:${game.ownAnswer?.retriesLeft}:${game.ownAnswer?.text}`
  const clock = game.pausedAt ?? w.frozenAt ?? now
  const seconds = Math.max(0, Math.ceil((game.deadline - clock) / 1000))
  const progress = Math.min(1, Math.max(0, (game.deadline - clock) / WHO_ZONE_MS[w.zone]))
  const eligible = me !== null && w.eligible.includes(me)
  const locked =
    !online || game.pausedAt !== null || !eligible || seconds === 0 || sent === acknowledgement
  const own = game.ownAnswer?.zone === w.zone ? game.ownAnswer : undefined
  const state = turnPresentation(game, me, online)
  const fr = game.options.language === 'fr'
  const activeName = game.players.find(p => p.id === w.active)?.profile.name ?? ''
  const titles = {
    ready: fr ? 'À toi de jouer !' : 'Your turn!',
    race: fr ? 'À vous de jouer !' : 'Everyone can answer!',
    waiting: fr ? `${activeName} a la main` : `${activeName}’s turn`,
    wrong: fr ? 'Pas cette fois !' : 'Not this time!',
    blocked: fr ? 'Prochain indice…' : 'Next clue…',
    checking: fr ? 'Réponse envoyée !' : 'Answer sent!',
    checkingOther: fr ? 'Vérification…' : 'Checking…',
    clarify: fr ? 'Précise ta réponse !' : 'Be more specific!',
    unavailable: fr ? 'Réessaie !' : 'Try again!',
    paused: fr ? 'Pause reconnexion' : 'Reconnecting',
    offline: fr ? 'Reconnexion…' : 'Reconnecting…',
  }
  const detail =
    state === 'wrong'
      ? w.mode === 'duel'
        ? fr
          ? `${activeName} prend la main.`
          : `${activeName} takes the turn.`
        : t.wrong
      : state === 'checking' || state === 'checkingOther'
        ? t.checkingClock
        : state === 'ready' || state === 'race'
          ? `${w.points} ${t.points} · ${fr ? 'Trouve avant la fin du chrono !' : 'Answer before time runs out!'}`
          : state === 'clarify'
            ? t.clarify
            : state === 'unavailable'
              ? fr
                ? 'La vérification a échoué. Aucun essai perdu.'
                : 'The check failed. No attempt lost.'
              : state === 'paused' || state === 'offline'
                ? fr
                  ? 'Ta place et ta réponse sont conservées.'
                  : 'Your place and answer are saved.'
                : t.prepare
  const submitLabel =
    sent === acknowledgement || own?.status === 'pending'
      ? fr
        ? 'Envoyé'
        : 'Sent'
      : !eligible
        ? fr
          ? 'Patiente'
          : 'Wait'
        : fr
          ? 'Valider'
          : 'Answer'
  const icon =
    state === 'wrong'
      ? '×'
      : state === 'ready' || state === 'race'
        ? '▶'
        : state === 'clarify'
          ? '?'
          : 'Ⅱ'
  return (
    <section className="who-round" data-turn={state}>
      <div
        className="game-turn-banner"
        key={`${w.zone}:${state}:${w.active}`}
        data-state={state}
        role="status"
      >
        <span className="game-turn-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <strong>{titles[state]}</strong>
          <p>{detail}</p>
        </div>
      </div>
      <div className="who-mode">
        <span>{w.mode === 'duel' ? t.duel : t.race}</span>
        <span>
          {game.round + 1} / {game.total}
        </span>
      </div>
      <ol className="who-track" aria-label="4 → 3 → 2 → 1">
        {WHO_ZONE_MS.map((duration, i) => (
          <li
            key={i}
            data-current={i === w.zone}
            data-past={i < w.zone}
            aria-current={i === w.zone ? 'step' : undefined}
          >
            <strong>{4 - i}</strong>
            <span>{i === 3 ? t.point : t.points}</span>
            <small>{duration / 1000} s</small>
            {i === w.zone && (
              <span className="who-track-fill" style={{ transform: `scaleX(${progress})` }} />
            )}
          </li>
        ))}
      </ol>
      <div className="who-riddle" key={w.zone}>
        <img src="./assets/games/who.webp" alt="" width="140" height="140" />
        <div className="who-clue-heading">
          <span>
            {t.clue} {w.zone + 1} / 4
          </span>
          <div
            className="who-timer"
            style={{ '--remaining': `${progress * 100}%` } as CSSProperties}
            role="timer"
            data-urgent={seconds <= 5 && w.frozenAt === null && game.pausedAt === null}
            aria-label={`${seconds} s`}
          >
            <span>
              {w.frozenAt !== null || game.pausedAt !== null ? 'Ⅱ' : seconds}
              <small>{w.frozenAt !== null || game.pausedAt !== null ? `${seconds} s` : 's'}</small>
            </span>
          </div>
        </div>
        <p aria-live="polite">{game.clues?.[w.zone]}</p>
      </div>
      {w.zone > 0 && (
        <details className="who-history">
          <summary>
            {t.previous} <span>{w.zone}</span>
          </summary>
          <ol>
            {game.clues?.slice(0, w.zone).map((clue, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {clue}
              </li>
            ))}
          </ol>
        </details>
      )}
      <form
        className="who-answer"
        onSubmit={event => {
          event.preventDefault()
          if (!locked && text.trim() && onAnswer(text.trim(), w.zone)) setSent(acknowledgement)
        }}
      >
        <label htmlFor={inputId}>{eligible ? t.answer : t.prepare}</label>
        <div className="who-input-row">
          <input
            id={inputId}
            value={text}
            maxLength={160}
            autoComplete="off"
            placeholder={t.placeholder}
            onChange={e => setText(e.target.value)}
          />
          <button
            className="games-primary who-submit"
            type="submit"
            disabled={locked || !text.trim()}
            aria-label={submitLabel}
            title={submitLabel}
          >
            <span className="who-submit-label">{submitLabel}</span>
            <svg
              className="who-submit-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {sent === acknowledgement || own?.status === 'pending' ? (
                <path d="M5 12l4 4L19 6" />
              ) : !eligible ? (
                <>
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l3 2" />
                </>
              ) : (
                <path d="M5 12h14M13 6l6 6-6 6" />
              )}
            </svg>
          </button>
        </div>
        <p className="who-rules">{w.mode === 'duel' ? t.duelRule : t.raceRule}</p>
      </form>
    </section>
  )
}
