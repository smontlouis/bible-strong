import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { WorldMultiplayer } from './multiplayer'
import {
  REACTIONS,
  REACTION_COOLDOWN_MS,
  reactionAsset,
  reactionCopy,
  type ReactionId,
} from './reactions'
import './reactions.css'

export function ReactionIcon({ reaction, color }: { reaction: ReactionId; color: string }) {
  return (
    <span className="reaction-icon" aria-hidden="true">
      <span
        className="reaction-body"
        style={
          {
            backgroundColor: color,
            backgroundImage: `url("${reactionAsset(reaction, 'body')}")`,
            maskImage: `url("${reactionAsset(reaction, 'body')}")`,
          } as CSSProperties
        }
      />
      <img src={reactionAsset(reaction, 'detail')} alt="" draggable={false} />
    </span>
  )
}

export function ReactionPicker({
  network,
  color,
  language,
  online,
  openRequest = 0,
}: {
  network?: WorldMultiplayer
  color: string
  language: 'fr' | 'en'
  online: boolean
  /** Increment to open the panel from elsewhere (the floating action under a visitor). */
  openRequest?: number
}) {
  const [open, setOpen] = useState(false)
  // Only a new request opens the panel: the picker remounts whenever a dialog closes, and
  // must not reopen for a request that was already served before that dialog.
  const served = useRef(openRequest)
  useEffect(() => {
    if (openRequest === served.current) return
    served.current = openRequest
    setOpen(true)
  }, [openRequest])
  const [cooldown, setCooldown] = useState(false)
  const [feedback, setFeedback] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const t = reactionCopy[language]
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(false), REACTION_COOLDOWN_MS)
    return () => window.clearTimeout(timer)
  }, [cooldown])
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  function send(reaction: ReactionId) {
    if (!network?.sendReaction(reaction)) {
      setFeedback(t.unavailable)
      return
    }
    setCooldown(true)
    setFeedback(`${t.sent} : ${t[reaction]}`)
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div className="reaction-controls" ref={root}>
      {open && (
        <div
          className="reaction-panel"
          ref={panel}
          id="world-reaction-picker"
          role="group"
          aria-label={t.title}
        >
          <p>{t.title}</p>
          <div className="reaction-grid">
            {REACTIONS.map(reaction => (
              <button
                type="button"
                key={reaction}
                disabled={!online || cooldown}
                onClick={() => send(reaction)}
                aria-label={t[reaction]}
                title={t[reaction]}
              >
                <ReactionIcon reaction={reaction} color={color} />
                <span>{t[reaction]}</span>
              </button>
            ))}
          </div>
          {!online && <p className="reaction-unavailable">{t.unavailable}</p>}
        </div>
      )}
      <button
        className="reaction-trigger"
        type="button"
        ref={trigger}
        aria-label={t.title}
        aria-expanded={open}
        aria-controls="world-reaction-picker"
        onClick={() => setOpen(value => !value)}
      >
        <ReactionIcon reaction="hello" color={color} />
      </button>
      <span className="sr-only" role="status">
        {feedback}
      </span>
    </div>
  )
}
