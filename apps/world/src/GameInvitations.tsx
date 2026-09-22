import { useEffect, useRef } from 'react'
import type { GameInvitation, GameError } from './games-protocol'
import { AvatarPreview } from './AvatarEditor'
import './game-invitations.css'

const labels = {
  fr: {
    invited: 't’invite à jouer !',
    open: 'Voir l’invitation',
    title: 'Une partie ensemble ?',
    expiry: 'Pour répondre',
    expired: 'Cette invitation n’est plus disponible.',
    expiredHelp: 'Le salon a pu démarrer, se remplir ou l’invitation a expiré.',
    join: 'Accepter et rejoindre',
    decline: 'Décliner',
    pending: 'Connexion au salon…',
    declining: 'Refus en cours…',
    offline: 'Reconnexion… Tu pourras répondre dès le retour de la connexion.',
    back: 'Revenir au monde',
    who: 'Qui suis-je ?',
    quiz: 'Défi biblique',
    easy: 'Découverte',
    medium: 'Intermédiaire',
    hard: 'Avancé',
    language: 'Partie en',
    players: '2 à 4 joueurs',
    rounds: '5 manches',
    notifications: 'Invitations reçues',
    failed: 'Impossible de répondre pour le moment. Réessaie.',
    busy: 'Tu as déjà rejoint une autre partie.',
    full: 'Ce salon est complet.',
    expiredError: 'Cette invitation a expiré.',
    rate_limited: 'Patiente un instant avant de réessayer.',
  },
  en: {
    invited: 'invites you to play!',
    open: 'View invitation',
    title: 'Let’s play together!',
    expiry: 'Time to reply',
    expired: 'This invitation is no longer available.',
    expiredHelp: 'The lobby may have started, filled up, or the invitation expired.',
    join: 'Accept and join',
    decline: 'Decline',
    pending: 'Joining the lobby…',
    declining: 'Declining…',
    offline: 'Reconnecting… You can reply when the connection returns.',
    back: 'Return to the world',
    who: 'Who am I?',
    quiz: 'Bible challenge',
    easy: 'Discovery',
    medium: 'Intermediate',
    hard: 'Advanced',
    language: 'Playing in',
    players: '2–4 players',
    rounds: '5 rounds',
    notifications: 'Incoming invitations',
    failed: 'Unable to reply right now. Try again.',
    busy: 'You already joined another game.',
    full: 'This lobby is full.',
    expiredError: 'This invitation has expired.',
    rate_limited: 'Wait a moment before trying again.',
  },
}

export function InvitationNotifications({
  invitations,
  now,
  language,
  inline = false,
  disabled,
  onSelect,
}: {
  invitations: GameInvitation[]
  now: number
  language: 'fr' | 'en'
  inline?: boolean
  disabled: boolean
  onSelect: (invite: GameInvitation) => void
}) {
  const t = labels[language]
  const live = invitations.filter(i => i.expires > now)
  if (!live.length) return null
  return (
    <aside className="game-invite-notifications" data-inline={inline} aria-label={t.notifications}>
      {live.map(invite => (
        <button
          className="game-invite-toast"
          key={invite.id}
          onClick={() => onSelect(invite)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label={`${invite.from.name} ${t.invited} ${t[invite.options.kind]}. ${t.open}`}
        >
          <span className="game-invite-avatar">
            <AvatarPreview avatar={invite.from.avatar} color={invite.from.color} />
            <span aria-hidden="true">✦</span>
          </span>
          <span className="game-invite-message">
            <span role="status">
              <strong>{invite.from.name}</strong>
              <span>{t.invited}</span>
            </span>
            <b>{t[invite.options.kind]}</b>
            <span className="game-invite-open">
              {t.open} <span aria-hidden="true">→</span>
            </span>
          </span>
          <span className="game-invite-seconds" aria-hidden="true">
            {Math.max(0, Math.ceil((invite.expires - now) / 1000))}
            <small>s</small>
          </span>
        </button>
      ))}
    </aside>
  )
}

export function InvitationDetail({
  invitation,
  now,
  available,
  online,
  pending,
  issue,
  language,
  titleId,
  onAccept,
  onDecline,
  onBack,
}: {
  invitation: GameInvitation
  now: number
  available: boolean
  online: boolean
  pending: 'accept' | 'decline' | null
  issue: GameError | null
  language: 'fr' | 'en'
  titleId: string
  onAccept: () => void
  onDecline: () => void
  onBack: () => void
}) {
  const t = labels[language]
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [invitation.id])
  const seconds = Math.max(0, Math.ceil((invitation.expires - now) / 1000))
  const active = available && seconds > 0
  const locked = !active || !online || pending !== null
  const error =
    issue === 'full'
      ? t.full
      : issue === 'busy'
        ? t.busy
        : issue === 'expired'
          ? t.expiredError
          : issue === 'rate_limited'
            ? t.rate_limited
            : t.failed
  return (
    <section className="game-invite-detail">
      <span className="games-eyebrow">{t.notifications}</span>
      <div className="game-invite-host">
        <AvatarPreview avatar={invitation.from.avatar} color={invitation.from.color} />
        <span aria-hidden="true">✦</span>
      </div>
      <h1 id={titleId} ref={heading} tabIndex={-1}>
        {invitation.from.name}
      </h1>
      <p className="game-invite-subtitle">{t.invited}</p>
      <div className="game-invite-ticket" data-kind={invitation.options.kind}>
        <img
          src={`./assets/games/${invitation.options.kind}.webp`}
          alt=""
          width="130"
          height="130"
        />
        <h2>{t[invitation.options.kind]}</h2>
        <div className="game-invite-tags">
          <span>{t[invitation.options.difficulty]}</span>
          <span>{t.players}</span>
          <span>{t.rounds}</span>
        </div>
        <p>
          {t.language}{' '}
          <strong>{invitation.options.language === 'fr' ? 'Français' : 'English'}</strong>
        </p>
      </div>
      {active ? (
        <p className="game-invite-expiry">
          {t.expiry} <strong>{seconds} s</strong>
        </p>
      ) : (
        <div className="games-notice" role="status">
          <strong>{t.expired}</strong>
          <p>{t.expiredHelp}</p>
        </div>
      )}
      {!online && (
        <p className="games-notice" role="status">
          {t.offline}
        </p>
      )}
      {issue && active && (
        <p className="games-notice games-error" role="alert">
          {error}
        </p>
      )}
      {active ? (
        <div className="game-invite-actions">
          <button className="games-primary" disabled={locked} onClick={onAccept}>
            {pending === 'accept' ? t.pending : t.join}
            <span aria-hidden="true"> →</span>
          </button>
          <button className="games-text" disabled={locked} onClick={onDecline}>
            {pending === 'decline' ? t.declining : t.decline}
          </button>
        </div>
      ) : (
        <button className="games-primary" onClick={onBack}>
          {t.back}
        </button>
      )}
    </section>
  )
}
