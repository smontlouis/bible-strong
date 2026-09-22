import { SoloGameView } from './SoloGameView'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type {
  GameAction,
  GameOptions,
  GameError,
  GameInvitation,
  GamesSnapshot,
  GameMember,
} from './games-protocol'
import { InvitationNotifications, InvitationDetail } from './GameInvitations'
import { AvatarPreview } from './AvatarEditor'
import { Modal } from './Modal'
import { awardedPoints } from './game-presentation'
import { GameFeedback, GameFinale } from './GameFeedback'
import { WhoRound, WhoPlayers } from './WhoRound'
import { Countdown, Curtain, PunchNumber, useScreenTransition, useTransient } from './game-juice'
import { haptic } from './haptics'
import {
  AnimatePresence,
  Appear,
  AppearP,
  GameMotion,
  collapse,
  item,
  motion,
  pop,
  staggerAfter,
  swap,
} from './game-motion'
import './bible-games.css'

const copy = {
  fr: {
    button: 'Jouer ensemble',
    resume: 'Ma partie',
    title: 'À toi de jouer.',
    eyebrow: 'LE COIN DES JEUX',
    intro: 'Relève un défi en solo ou joue avec les explorateurs près de toi.',
    who: 'Qui suis-je ?',
    quiz: 'Défi biblique',
    whoDescription: 'Quatre indices. Trouvez avant les autres.',
    quizDescription: 'Cinq questions pour explorer les récits bibliques.',
    people: 'Personnages',
    places: 'Lieux',
    objects: 'Objets',
    mixed: 'Surprise-moi',
    old: 'Ancien Testament',
    new: 'Nouveau Testament',
    both: 'Toute la Bible',
    easy: 'Découverte',
    medium: 'Intermédiaire',
    hard: 'Avancé',
    subject: 'À découvrir',
    testament: 'Dans quel univers ?',
    difficulty: 'Difficulté',
    create: 'Ouvrir un salon',
    close: 'Revenir au monde',
    lobby: 'Un moment à partager',
    lobbyDescription:
      'Invite jusqu’à trois explorateurs. La partie commence quand vous êtes au moins deux.',
    nearby: 'Près de toi',
    noNearby: 'Approche-toi d’un autre avatar pour lui proposer une partie.',
    invite: 'Inviter',
    invited: 'Invitation envoyée',
    join: 'Rejoindre',
    decline: 'Pas maintenant',
    invites: 'On t’invite à jouer',
    from: 'te propose',
    start: 'C’est parti !',
    waiting: 'L’hôte lancera la partie.',
    leave: 'Quitter la partie',
    generating: 'Votre aventure prend forme…',
    generatingDescription:
      'Nous choisissons cinq découvertes dans le catalogue biblique. Un instant…',
    round: 'Manche',
    clue: 'Indice',
    answer: 'Ta réponse',
    placeholder: 'Écris un nom, un lieu, un objet…',
    submit: 'Valider ma réponse',
    attemptsEnded: 'Tes tentatives sont terminées. Attendons la suite.',
    received: 'Réponse reçue. Attendons les autres.',
    clarify: 'Peux-tu préciser ta réponse ? Tu peux la compléter.',
    unavailable:
      'La vérification n’a pas abouti. Tu peux réessayer ; cette panne ne te pénalisera pas.',
    correct: 'Bien trouvé !',
    wrong: 'Une découverte de plus !',
    skipped: 'Pas de réponse',
    pending: 'Réponse reçue',
    read: 'Lire le passage',
    next: 'Manche suivante',
    results: 'Voir les résultats',
    waitingNext: 'L’hôte peut passer à la suite.',
    finish: 'La partie est terminée !',
    finishDescription: 'Merci d’avoir exploré la Bible ensemble.',
    again: 'Choisir une autre aventure',
    offline: 'Connexion interrompue. Ta place est conservée pendant la reconnexion.',
    paused: 'La partie attend le retour d’un explorateur.',
    absent: 'De retour bientôt',
    host: 'Hôte',
    you: 'Toi',
    point: 'point',
    points: 'points',
    void: 'Cette manche ne compte pas : une réponse n’a pas pu être vérifiée.',
    rules: '2–4 joueurs · 5 manches',
    invitationExpiry: 'Les invitations durent une minute.',
    generation_failed: 'La préparation n’a pas abouti. L’hôte peut réessayer.',
    not_enough_players: 'La partie s’est arrêtée : il reste moins de deux joueurs.',
    expired: 'Ce salon a expiré.',
    errors: {
      busy: 'Cet explorateur participe déjà à une partie.',
      expired: 'Cette invitation ou cette partie a expiré.',
      full: 'Le salon est complet.',
      not_host: 'Seul l’hôte peut effectuer cette action.',
      not_ready: 'La partie n’est pas prête pour cette action.',
      too_far: 'Cet explorateur s’est éloigné. Rapproche-toi pour l’inviter.',
      unavailable: 'Connexion indisponible. Réessaie dans un instant.',
      rate_limited: 'Patiente un instant avant de réessayer.',
      invalid: 'Cette réponse ne peut pas être envoyée.',
    } satisfies Record<GameError, string>,
  },
  en: {
    button: 'Play together',
    resume: 'My game',
    title: 'Your turn to play.',
    eyebrow: 'THE GAMES CORNER',
    intro: 'Take on a solo challenge or play with nearby explorers.',
    who: 'Who am I?',
    quiz: 'Bible challenge',
    whoDescription: 'Four clues. Be the first to discover.',
    quizDescription: 'Five questions to explore biblical stories.',
    people: 'People',
    places: 'Places',
    objects: 'Objects',
    mixed: 'Surprise me',
    old: 'Old Testament',
    new: 'New Testament',
    both: 'The whole Bible',
    easy: 'Discovery',
    medium: 'Intermediate',
    hard: 'Advanced',
    subject: 'Discover',
    testament: 'Which setting?',
    difficulty: 'Difficulty',
    create: 'Open a lobby',
    close: 'Return to the world',
    lobby: 'A moment to share',
    lobbyDescription: 'Invite up to three explorers. Start when at least two of you are ready.',
    nearby: 'Near you',
    noNearby: 'Move closer to another avatar to invite them to play.',
    invite: 'Invite',
    invited: 'Invitation sent',
    join: 'Join',
    decline: 'Not now',
    invites: 'You are invited',
    from: 'invites you to',
    start: 'Let’s go!',
    waiting: 'The host will start the game.',
    leave: 'Leave game',
    generating: 'Your adventure is taking shape…',
    generatingDescription:
      'We are selecting five discoveries from the Bible catalogue. One moment…',
    round: 'Round',
    clue: 'Clue',
    answer: 'Your answer',
    placeholder: 'Enter a person, place or object…',
    submit: 'Submit my answer',
    attemptsEnded: 'You have used your attempts. Waiting for the next step.',
    received: 'Answer received. Waiting for the others.',
    clarify: 'Can you be more specific? You can complete your answer.',
    unavailable:
      'We could not check your answer. Try again; this failure will not count against you.',
    correct: 'Well spotted!',
    wrong: 'Another discovery!',
    skipped: 'No answer',
    pending: 'Answer received',
    read: 'Read the passage',
    next: 'Next round',
    results: 'See results',
    waitingNext: 'The host can continue to the next round.',
    finish: 'That’s a wrap!',
    finishDescription: 'Thank you for exploring the Bible together.',
    again: 'Choose another adventure',
    offline: 'Connection interrupted. Your place is saved while reconnecting.',
    paused: 'Waiting for an explorer to return.',
    absent: 'Back soon',
    host: 'Host',
    you: 'You',
    point: 'point',
    points: 'points',
    void: 'This round does not count: an answer could not be checked.',
    rules: '2–4 players · 5 rounds',
    invitationExpiry: 'Invitations last one minute.',
    generation_failed: 'We could not prepare this game. The host can try again.',
    not_enough_players: 'The game ended: fewer than two players remain.',
    expired: 'This lobby has expired.',
    errors: {
      busy: 'This explorer is already in a game.',
      expired: 'This invitation or game has expired.',
      full: 'This lobby is full.',
      not_host: 'Only the host can do that.',
      not_ready: 'The game is not ready for that action.',
      too_far: 'This explorer has moved away. Move closer to invite them.',
      unavailable: 'Connection unavailable. Please try again shortly.',
      rate_limited: 'Wait a moment before trying again.',
      invalid: 'This answer cannot be sent.',
    } satisfies Record<GameError, string>,
  },
}

function GameSelectionIcon({ selected }: { selected: boolean }) {
  if (!selected) return null
  return (
    <span className="games-selection" data-selected="true" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="m6.5 12.5 3.5 3.5 7.5-8" />
      </svg>
    </span>
  )
}
/** Pure application boundary: plain snapshots, a supplied clock and user-action callbacks.
 * Local input drafts and visual animation are owned by the presentation components. */
export type BibleGamesViewProps = {
  snapshot: GamesSnapshot
  me: string | null
  online: boolean
  error: GameError | null
  now: number
  language: 'fr' | 'en'
  open: boolean
  disabled?: boolean
  stationOnly?: boolean
  options: GameOptions
  setOptions: (options: GameOptions) => void
  selectedInvitation: GameInvitation | null
  invitationIssue: GameError | null
  invitationAction: { action: 'accept' | 'decline' } | null
  nearby: Pick<GameMember, 'id' | 'profile'>[]
  onOpen: () => void
  close: () => void
  selectInvitation: (invitation: GameInvitation) => void
  answerInvitation: (action: 'accept' | 'decline') => void
  send: (action: GameAction) => boolean
}
export function BibleGamesView({
  snapshot,
  me,
  online,
  error,
  now,
  language,
  open,
  disabled = false,
  stationOnly = false,
  options,
  setOptions,
  selectedInvitation,
  invitationIssue,
  invitationAction,
  nearby,
  onOpen,
  close,
  selectInvitation,
  answerInvitation,
  send,
}: BibleGamesViewProps) {
  const state = { snapshot, me, online, error }
  const { game, invitations } = snapshot
  const id = useId()
  const t = copy[game?.options.language ?? language]
  const host = game?.host === me
  const canReceive = !game || game.phase === 'finished'
  // Screen transitions and shakes are pure presentation keyed on the snapshot.
  const shell = useRef<HTMLDivElement>(null)
  const screenKey = selectedInvitation
    ? `invite:${selectedInvitation.id}`
    : game
      ? `${game.id}:${game.phase === 'generating' ? 'question' : game.phase}`
      : 'choose'
  const screen = useScreenTransition(screenKey)
  const [shake, setShake] = useState(0)
  const shaking = useTransient(shake, 450, shake > 0)
  const onShake = () => setShake(n => n + 1)
  // Shared games count 3 · 2 · 1 while the catalogue prepares, exactly like solo.
  const multiGenerating = !!game && !game.solo && game.phase === 'generating'
  const [counting, setCounting] = useState(multiGenerating)
  const [countCurtain, setCountCurtain] = useState(0)
  useEffect(() => {
    if (multiGenerating) setCounting(true)
    if (!game || game.phase === 'lobby' || game.phase === 'finished' || game.phase === 'reveal')
      setCounting(false)
  }, [multiGenerating, game?.phase, game?.id])
  const curtainTone =
    game?.phase === 'generating'
      ? 'navy'
      : game && !game.solo && game.options.kind === 'quiz'
        ? 'yellow'
        : 'blue'
  const curtainLabel = !game
    ? null
    : game.phase === 'question' && !game.solo
      ? `${t.round} ${game.round + 1} / ${game.total}`
      : game.phase === 'question' || game.phase === 'finished'
        ? '★'
        : game.phase === 'generating'
          ? '✦'
          : null
  return (
    <>
      {!open && !disabled && canReceive && (
        <InvitationNotifications
          invitations={invitations}
          now={now}
          language={language}
          disabled={invitationAction !== null}
          onSelect={selectInvitation}
        />
      )}
      {(!stationOnly || game) && (
        <button
          className="games-launch"
          onClick={onOpen}
          disabled={disabled}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">✦</span> {game ? t.resume : t.button}
        </button>
      )}
      {open && (
        <Modal
          className={`games-dialog${selectedInvitation ? ' games-invite-dialog' : ''}`}
          labelledBy={id}
          closeLabel={t.close}
          onClose={close}
        >
          <GameMotion>
          <div
            ref={shell}
            className="games-shell"
            data-kind={selectedInvitation?.options.kind ?? game?.options.kind ?? options.kind}
            data-who-phase={game?.who ? game.phase : undefined}
            data-phase={game?.phase ?? 'choose'}
            data-enter={screen.parity}
            data-shake={shaking}
          >
            <Curtain token={screen.count} anchor={shell} tone={curtainTone} label={curtainLabel} />
            <Curtain token={countCurtain} anchor={shell} tone={curtainTone} label="★" />
            {selectedInvitation ? (
              <InvitationDetail
                invitation={selectedInvitation}
                now={now}
                available={canReceive && invitations.some(i => i.id === selectedInvitation.id)}
                online={state.online}
                pending={invitationAction?.action ?? null}
                issue={invitationIssue}
                language={language}
                titleId={id}
                onAccept={() => answerInvitation('accept')}
                onDecline={() => answerInvitation('decline')}
                onBack={close}
              />
            ) : game?.solo ? (
              <SoloGameView
                key={game.id}
                game={game}
                now={online ? now : snapshot.now}
                online={online}
                error={error}
                titleId={id}
                send={send}
                onShake={onShake}
              />
            ) : game && counting ? (
              <>
                <Countdown
                  screen
                  anchor={shell}
                  steps={['3', '2', '1', game.options.language === 'fr' ? 'Partez !' : 'Go!']}
                  ready={game.phase === 'question'}
                  onTick={index => haptic(index === 3 ? 'success' : 'tick')}
                  onDone={() => {
                    setCounting(false)
                    setCountCurtain(n => n + 1)
                  }}
                >
                  <small>
                    {game.phase === 'generating'
                      ? t.generatingDescription
                      : `${t[game.options.kind]} · ${t.rules}`}
                  </small>
                </Countdown>
              </>
            ) : (
              <>
                {canReceive && (
                  <InvitationNotifications
                    invitations={invitations}
                    now={now}
                    language={language}
                    inline
                    disabled={invitationAction !== null}
                    onSelect={selectInvitation}
                  />
                )}
                <header className="games-header">
                  <span className="games-eyebrow">{t.eyebrow}</span>
                  <h1 id={id}>
                    {!game
                      ? t.title
                      : game.phase === 'lobby'
                        ? t.lobby
                        : game.phase === 'generating'
                          ? t.generating
                          : game.phase === 'finished'
                            ? game.reason
                              ? t[game.reason]
                              : t.finish
                            : t[game.options.kind]}
                  </h1>
                  <p>
                    {!game
                      ? t.intro
                      : game.phase === 'lobby'
                        ? t.lobbyDescription
                        : game.phase === 'generating'
                          ? t.generatingDescription
                          : game.phase === 'finished'
                            ? t.finishDescription
                            : `${t.round} ${game.round + 1} / ${game.total}`}
                  </p>
                </header>
                <AnimatePresence initial={false} mode="popLayout">
                  {!state.online && (
                    <AppearP key="offline" className="games-notice" role="status">
                      {t.offline}
                    </AppearP>
                  )}
                  {state.error && (
                    <AppearP key="error" className="games-notice games-error" role="alert">
                      {t.errors[state.error]}
                    </AppearP>
                  )}
                  {game?.pausedUntil != null && (
                    <AppearP key="pause" className="games-notice game-pause" role="status">
                      <span aria-hidden="true">Ⅱ </span>
                      {game.players
                        .filter(p => p.absentSince !== null)
                        .map(p => p.profile.name)
                        .join(', ')}{' '}
                      · {t.paused}{' '}
                      <strong>{Math.max(0, Math.ceil((game.pausedUntil - now) / 1000))} s</strong>
                    </AppearP>
                  )}
                </AnimatePresence>
                {!game && (
                  <>
                    <div
                      className="solo-mode-picker"
                      aria-label={language === 'fr' ? 'Mode de jeu' : 'Game mode'}
                    >
                      <button
                        className="games-secondary"
                        aria-pressed={options.mode === 'solo'}
                        onClick={() => {
                          haptic('select')
                          setOptions({ ...options, mode: 'solo', kind: 'quiz' })
                        }}
                      >
                        ★ {language === 'fr' ? 'Solo' : 'Solo'}
                      </button>
                      <button
                        className="games-secondary"
                        aria-pressed={options.mode !== 'solo'}
                        onClick={() => {
                          haptic('select')
                          setOptions({ ...options, mode: 'together' })
                        }}
                      >
                        ✦ {language === 'fr' ? 'Jouer ensemble' : 'Play together'}
                      </button>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                    {options.mode === 'solo' ? (
                      <motion.div key="solo" className="games-cards games-cards-solo" {...swap}>
                        <div className="games-card" data-selected="true">
                          <GameSelectionIcon selected />
                          <img src="./assets/games/solo.webp" alt="" width="220" height="220" />
                          <strong>{language === 'fr' ? '4 à la suite' : 'Four in a row'}</strong>
                          <span>
                            {language === 'fr'
                              ? 'Quatre bonnes réponses d’affilée pour gagner.'
                              : 'Four correct answers in a row to win.'}
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="together" className="games-cards" {...swap}>
                        {(['who', 'quiz'] as const).map(kind => (
                          <button
                            key={kind}
                            className="games-card"
                            data-kind={kind}
                            aria-pressed={options.kind === kind}
                            onClick={() => {
                              haptic('select')
                              setOptions({ ...options, kind })
                            }}
                          >
                            <GameSelectionIcon selected={options.kind === kind} />
                            <img
                              src={`./assets/games/${kind}.webp`}
                              alt=""
                              width="220"
                              height="220"
                            />
                            <strong>{t[kind]}</strong>
                            <span>{kind === 'who' ? t.whoDescription : t.quizDescription}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                    </AnimatePresence>
                    <motion.div className="games-options" layout>
                      <AnimatePresence initial={false} mode="popLayout">
                      {(
                        [
                          ['testament', ['both', 'old', 'new']],
                          ['difficulty', ['easy', 'medium', 'hard']],
                        ] as const
                      )
                        .filter(
                          ([key]) =>
                            key !== 'difficulty' ||
                            options.mode === 'solo' ||
                            options.kind !== 'who'
                        )
                        .map(([key, values]) => (
                          <motion.label key={key} layout {...collapse}>
                            {t[key]}
                            <select
                              value={options[key]}
                              onChange={event =>
                                setOptions({ ...options, [key]: event.target.value })
                              }
                            >
                              {values.map(value => (
                                <option key={value} value={value}>
                                  {t[value]}
                                </option>
                              ))}
                            </select>
                          </motion.label>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                    <footer className="games-actions">
                      <small>
                        {options.mode === 'solo'
                          ? language === 'fr'
                            ? '1 joueur'
                            : '1 player'
                          : t.rules}
                      </small>
                      <button
                        className="games-primary juice-shine-host"
                        disabled={!state.online || invitationAction !== null}
                        onClick={() =>
                          send({ action: 'create', options: { ...options, language } })
                        }
                      >
                        {options.mode === 'solo'
                          ? language === 'fr'
                            ? 'Préparer mon défi'
                            : 'Prepare my challenge'
                          : t.create}{' '}
                        <span aria-hidden="true">→</span>
                      </button>
                    </footer>
                  </>
                )}
                {game && (
                  <>
                    <GameFeedback game={game} me={state.me} onShake={onShake} />
                    {game.phase === 'finished' ? (
                      <GameFinale game={game} me={state.me} />
                    ) : game.who ? (
                      <WhoPlayers game={game} me={state.me} />
                    ) : (
                      <div className="games-players" aria-label={t.rules}>
                        <AnimatePresence initial={false} mode="popLayout">
                        {game.players.map(p => (
                          <Appear
                            className="games-player"
                            key={p.id}
                            data-absent={p.absentSince !== null}
                            data-answered={
                              game.phase === 'question' && game.answered.includes(p.id)
                            }
                            data-me={p.id === state.me}
                          >
                            <AvatarPreview avatar={p.profile.avatar} color={p.profile.color} />
                            <strong>
                              {p.profile.name}
                              {p.id === state.me ? ` · ${t.you}` : ''}
                            </strong>
                            <small data-score-for={p.id}>
                              {p.absentSince !== null ? (
                                t.absent
                              ) : game.phase === 'lobby' ? (
                                p.id === game.host ? (
                                  t.host
                                ) : (
                                  '✓'
                                )
                              ) : (
                                <>
                                  <PunchNumber value={p.score} />{' '}
                                  {p.score === 1 ? t.point : t.points}
                                </>
                              )}
                            </small>
                            {game.phase === 'question' && p.absentSince === null && (
                              <span className="game-player-reply">
                                {game.answered.includes(p.id)
                                  ? game.options.language === 'fr'
                                    ? 'Envoyé ✓'
                                    : 'Sent ✓'
                                  : game.options.language === 'fr'
                                    ? 'Réfléchit…'
                                    : 'Thinking…'}
                              </span>
                            )}
                          </Appear>
                        ))}
                        {game.phase === 'lobby' &&
                          Array.from({ length: 4 - game.players.length }, (_, i) => (
                            <Appear
                              className="games-player games-empty"
                              key={`empty${i}`}
                              aria-hidden="true"
                            >
                              <span>
                                <svg viewBox="0 0 24 24" focusable="false">
                                  <path d="M12 6v12M6 12h12" />
                                </svg>
                              </span>
                            </Appear>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                    <AnimatePresence initial={false} mode="popLayout">
                      {game.reason && game.phase !== 'finished' && (
                        <AppearP key="reason" className="games-notice" role="status">
                          {t[game.reason]}
                        </AppearP>
                      )}
                    </AnimatePresence>
                    {game.phase === 'lobby' && (
                      <>
                        {game.options.kind === 'who' && (
                          <AppearP className="games-notice" layout>
                            {game.players.length <= 2
                              ? game.options.language === 'fr'
                                ? 'En duel, vous répondez chacun votre tour. Trouver dès le premier indice rapporte 4 points, puis 3, 2 et 1.'
                                : 'In a duel you take turns answering. Finding it on the first clue earns 4 points, then 3, 2 and 1.'
                              : game.options.language === 'fr'
                                ? 'À trois ou quatre, tout le monde peut répondre à chaque indice, avec une seule tentative.'
                                : 'With three or four players, everyone can answer each clue, with a single attempt.'}
                          </AppearP>
                        )}
                        {host && (
                          <motion.section className="games-nearby" layout>
                            <h2>{t.nearby}</h2>
                            <AnimatePresence initial={false} mode="popLayout">
                            {nearby.length ? (
                              nearby.map(p => (
                                <Appear key={p.id}>
                                  <AvatarPreview avatar={p.profile.avatar} color={p.profile.color} />
                                  <span>{p.profile.name}</span>
                                  <button
                                    className="games-secondary"
                                    disabled={
                                      !state.online ||
                                      game.players.length >= 4 ||
                                      game.invited.includes(p.id)
                                    }
                                    onClick={() => send({ action: 'invite', target: p.id })}
                                  >
                                    {game.invited.includes(p.id) ? t.invited : t.invite}
                                  </button>
                                </Appear>
                              ))
                            ) : (
                              <AppearP key="nobody">{t.noNearby}</AppearP>
                            )}
                            </AnimatePresence>
                            <small>{t.invitationExpiry}</small>
                          </motion.section>
                        )}
                        <footer className="games-actions">
                          <button
                            className="games-text"
                            disabled={!state.online}
                            onClick={() => send({ action: 'leave' })}
                          >
                            {t.leave}
                          </button>
                          {host ? (
                            <button
                              className="games-primary juice-shine-host"
                              disabled={
                                !state.online ||
                                game.players.length < 2 ||
                                game.players.some(p => p.absentSince !== null)
                              }
                              onClick={() => send({ action: 'start' })}
                            >
                              {t.start}
                            </button>
                          ) : (
                            <p>{t.waiting}</p>
                          )}
                        </footer>
                      </>
                    )}
                    {game.phase === 'question' && game.who && (
                      <WhoRound
                        key={game.id}
                        game={game}
                        me={state.me}
                        online={state.online}
                        now={now}
                        onAnswer={(text, zone) =>
                          send({ action: 'answer', gameId: game.id, round: game.round, zone, text })
                        }
                        onShake={onShake}
                      />
                    )}
                    {game.phase === 'question' && !game.who && (
                      <section className="games-round">
                        <div className="game-quiz-status" role="status">
                          <strong>
                            {game.ownAnswer?.status === 'pending'
                              ? game.options.language === 'fr'
                                ? 'Aux autres de jouer !'
                                : 'Waiting for the others!'
                              : game.options.language === 'fr'
                                ? 'À vous de jouer !'
                                : 'Everyone can answer!'}
                          </strong>
                          <span>
                            <PunchNumber value={game.answered.length} /> / {game.players.length}{' '}
                            {game.options.language === 'fr' ? 'réponses envoyées' : 'answers sent'}
                          </span>
                        </div>
                        <div className="games-progress" aria-hidden="true">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span
                              key={i}
                              data-current={i === game.round}
                              data-done={i < game.round}
                            />
                          ))}
                        </div>
                        <div className="games-question">
                          <span className="games-clock">
                            {Math.max(
                              0,
                              Math.ceil((game.deadline - (game.pausedAt ?? now)) / 1000)
                            )}{' '}
                            s
                          </span>
                          <h2>{game.question}</h2>
                        </div>
                        {game.options.kind === 'who' && (
                          <ol className="games-clues">
                            {game.clues?.map((clue, i) => (
                              <li key={i}>
                                <small>
                                  {t.clue} {i + 1}
                                </small>
                                {clue}
                              </li>
                            ))}
                            {Array.from({ length: 3 - (game.clues?.length ?? 0) }, (_, i) => (
                              <li
                                key={`hidden${i}`}
                                className="games-clue-hidden"
                                aria-label={`${t.clue} ${(game.clues?.length ?? 0) + i + 1}`}
                              >
                                •••
                              </li>
                            ))}
                          </ol>
                        )}
                        <AnswerForm
                          key={game.id}
                          choices={game.choices}
                          initialText={game.ownAnswer?.text ?? ''}
                          status={game.ownAnswer?.status}
                          retriesLeft={game.ownAnswer?.retriesLeft ?? 3}
                          disabled={
                            !state.online || game.pausedUntil !== null || now >= game.deadline
                          }
                          t={t}
                          onAnswer={text =>
                            send({ action: 'answer', gameId: game.id, round: game.round, text })
                          }
                        />
                      </section>
                    )}
                    {game.phase === 'reveal' && game.result && (
                      <section className="games-reveal">
                        <span className="games-answer-label">
                          {game.options.language === 'fr' ? 'La réponse' : 'The answer'}
                        </span>
                        <h2 className="juice-stamp">{game.result.answer}</h2>
                        {game.choices && !game.result.void && (
                          <motion.div className="game-revealed-choices" {...staggerAfter(0.55)}>
                            {game.choices.map(choice => {
                              const correct = choice === game.result?.answer
                              const chosen = choice === game.ownAnswer?.text
                              return (
                                <motion.div
                                  key={choice}
                                  data-correct={correct}
                                  data-chosen={chosen}
                                  {...item}
                                >
                                  <span aria-hidden="true">
                                    {correct ? '✓' : chosen ? '×' : '·'}
                                  </span>
                                  <strong>{choice}</strong>
                                  {chosen && <small>{t.you}</small>}
                                </motion.div>
                              )
                            })}
                          </motion.div>
                        )}
                        <p>{game.result.explanation}</p>
                        {(
                          game.result.sources ?? [
                            { reference: game.result.reference, url: game.result.url },
                          ]
                        )
                          .filter(
                            (source, i, all) => all.findIndex(s => s.url === source.url) === i
                          )
                          .map(source => (
                            <a
                              key={source.url}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {source.reference} <span>{t.read} ↗</span>
                            </a>
                          ))}
                        {game.result.void && <p className="games-notice">{t.void}</p>}
                        <motion.div className="games-answer-list" {...staggerAfter(0.7)}>
                          {game.result.answers.map((a, index) => (
                            <motion.div
                              key={a.id}
                              data-status={game.result?.void ? 'void' : a.status}
                              style={{ '--i': index } as CSSProperties}
                              {...item}
                            >
                              <strong>{game.players.find(p => p.id === a.id)?.profile.name}</strong>
                              <span>{a.text || t.skipped}</span>
                              <small>
                                {game.result?.void
                                  ? '—'
                                  : a.status === 'correct'
                                    ? awardedPoints(game, a.id) > 0
                                      ? `✓ +${awardedPoints(game, a.id)}`
                                      : '✓'
                                    : a.status === 'wrong'
                                      ? '×'
                                      : '—'}
                              </small>
                            </motion.div>
                          ))}
                        </motion.div>
                      </section>
                    )}
                    {game.phase === 'reveal' && (
                      <footer className="games-actions">
                        <button
                          className="games-text"
                          disabled={!state.online}
                          onClick={() => send({ action: 'leave' })}
                        >
                          {t.leave}
                        </button>
                        {host ? (
                          <button
                            className="games-primary juice-shine-host"
                            disabled={!state.online || game.pausedUntil !== null}
                            onClick={() => send({ action: 'next' })}
                          >
                            {game.round === 4 ? t.results : t.next} →
                          </button>
                        ) : (
                          <p>{t.waitingNext}</p>
                        )}
                      </footer>
                    )}
                    {game.phase === 'finished' && (
                      <footer className="games-actions">
                        <small>{t.rules}</small>
                        <button
                          className="games-primary"
                          disabled={!state.online}
                          onClick={() => send({ action: 'leave' })}
                        >
                          {t.again}
                        </button>
                      </footer>
                    )}
                    {(game.phase === 'question' || game.phase === 'generating') && (
                      <footer className="games-actions">
                        <button
                          className="games-text"
                          disabled={!state.online}
                          onClick={() => send({ action: 'leave' })}
                        >
                          {t.leave}
                        </button>
                        <small>{t.rules}</small>
                      </footer>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          </GameMotion>
        </Modal>
      )}
    </>
  )
}
function AnswerForm({
  choices,
  initialText,
  status,
  retriesLeft,
  disabled,
  t,
  onAnswer,
}: {
  choices?: string[]
  initialText: string
  status?: string
  retriesLeft: number
  disabled: boolean
  t: typeof copy.fr | typeof copy.en
  onAnswer: (text: string) => boolean
}) {
  const [text, setText] = useState(initialText)
  const [sent, setSent] = useState<string | null>(null)
  const acknowledged = `${status}:${retriesLeft}:${initialText}`
  const [flight, setFlight] = useState<string | null>(null)
  useEffect(() => {
    if (flight === null) return
    const timer = setTimeout(() => setFlight(null), 5000)
    return () => clearTimeout(timer)
  }, [flight])
  const submit = (answer: string) => {
    if (onAnswer(answer)) {
      haptic('select')
      setSent(answer)
      setFlight(acknowledged)
    }
  }
  const locked =
    disabled ||
    flight === acknowledged ||
    retriesLeft === 0 ||
    status === 'pending' ||
    status === 'correct' ||
    status === 'wrong'
  if (flight === acknowledged || status === 'pending' || status === 'correct' || status === 'wrong')
    return (
      <Appear className="game-answer-sent" role="status">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>{sent ?? initialText}</strong>
          <p>{t.received}</p>
        </div>
      </Appear>
    )
  if (retriesLeft === 0)
    return (
      <AppearP className="games-notice" role="status">
        {t.attemptsEnded} {status === 'unavailable' ? t.void : ''}
      </AppearP>
    )
  return (
    <form
      className="games-answer-form"
      onSubmit={event => {
        event.preventDefault()
        if (text.trim() && !locked) submit(text)
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {status === 'clarify' && (
          <AppearP key="clarify" className="games-notice" role="status">
            {t.clarify}
          </AppearP>
        )}
        {status === 'unavailable' && (
          <AppearP key="unavailable" className="games-notice" role="status">
            {t.unavailable}
          </AppearP>
        )}
      </AnimatePresence>
      {choices ? (
        <div className="games-choices">
          {choices.map((choice, i) => (
            <button
              type="button"
              className="games-choice"
              key={choice}
              disabled={locked}
              onClick={() => {
                if (!locked) submit(choice)
              }}
            >
              <span>{String.fromCharCode(65 + i)}</span>
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <>
          <label>
            {t.answer}
            <input
              maxLength={160}
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder={t.placeholder}
              disabled={locked}
              autoComplete="off"
              autoCapitalize="sentences"
            />
          </label>
          <button className="games-primary" type="submit" disabled={locked || !text.trim()}>
            {t.submit} →
          </button>
        </>
      )}
    </form>
  )
}
