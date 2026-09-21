import { Modal } from './Modal'
import { useEffect, useRef, useState } from 'react'
import { AvatarPreview } from './AvatarEditor'
import { parseProfile, type AvatarProfile } from './avatar-profile'
import {
  MESSAGE_LIMIT,
  type GuestbookEntry,
  type GuestbookPage,
  type GuestbookSubmission,
} from './guestbook'
import './guestbook.css'

const copy = {
  fr: {
    title: 'Le livre d’or',
    eyebrow: 'UNE TRACE DE TON PASSAGE',
    subtitle: 'Un monde à explorer. Des souvenirs à partager.',
    read: 'Vos petits mots',
    write: 'À ton tour',
    invitation: 'Un petit mot avant de repartir ?',
    hint: 'Un encouragement, une découverte, un témoignage…',
    name: 'Prénom ou pseudo',
    message: 'Ton message',
    sign: 'Signer le livre',
    sending: 'Envoi en cours…',
    close: 'Fermer',
    empty: 'La première page est à vous.',
    emptyHint: 'Laisse le premier souvenir de cette aventure.',
    more: 'Lire les mots précédents',
    loading: 'Ouverture des pages…',
    retry: 'Réessayer',
    unavailable:
      'Impossible d’envoyer pour le moment. Ton texte est conservé, réessaie dans un instant.',
    rejected:
      'Ce mot ne peut pas être publié tel quel. Vérifie le pseudo et le message pour garder ce livre accueillant pour tous.',
    rate_limited: 'Un petit instant… Réessaie dans une minute.',
    invalid: 'Renseigne ton prénom et un message de 500 caractères maximum.',
    loadError: 'Les pages sont momentanément indisponibles.',
    success: 'Ta trace est ici.',
    thanks: 'Merci, tu fais maintenant partie de cette aventure !',
    public: 'Ton pseudo et ton message seront publics après une vérification automatique.',
    back: 'Revenir au monde',
  },
  en: {
    title: 'The guestbook',
    eyebrow: 'LEAVE A LITTLE MEMORY',
    subtitle: 'A world to explore. Memories to share.',
    read: 'Your little notes',
    write: 'Your turn',
    invitation: 'A little note before you go?',
    hint: 'An encouragement, a discovery, a story…',
    name: 'First name or nickname',
    message: 'Your message',
    sign: 'Sign the book',
    sending: 'Sending…',
    close: 'Close',
    empty: 'The first page is yours.',
    emptyHint: 'Leave the first memory of this adventure.',
    more: 'Read earlier notes',
    loading: 'Opening the pages…',
    retry: 'Try again',
    unavailable: 'Unable to send right now. Your text is saved; please try again shortly.',
    rejected:
      'This note cannot be published as it is. Please check your nickname and message to keep this book welcoming for everyone.',
    rate_limited: 'Just a moment… Please try again in a minute.',
    invalid: 'Enter your name and a message of up to 500 characters.',
    loadError: 'The pages are temporarily unavailable.',
    success: 'Your memory is here.',
    thanks: 'Thank you for being part of this adventure!',
    public: 'Your nickname and message will be public after an automatic check.',
    back: 'Return to the world',
  },
}
const DRAFT_KEY = 'bible-strong.world.guestbook.draft.v1'
function loadDraft(profile: AvatarProfile): GuestbookSubmission {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    const savedProfile = parseProfile(value?.profile)
    if (
      savedProfile &&
      value &&
      typeof value.id === 'string' &&
      typeof value.message === 'string' &&
      typeof value.profile?.name === 'string'
    )
      return { id: value.id, message: value.message.slice(0, MESSAGE_LIMIT), profile: savedProfile }
  } catch {
    /* Storage can be unavailable. The in-memory draft remains usable. */
  }
  return { id: crypto.randomUUID(), message: '', profile }
}
function endpoint() {
  const host = import.meta.env.VITE_WORLD_MULTIPLAYER_HOST
  return host
    ? new URL('/api/guestbook', host.includes('://') ? host : `${location.protocol}//${host}`).href
    : '/api/guestbook'
}
export function GuestbookDialog({
  profile,
  language,
  onClose,
}: {
  profile: AvatarProfile
  language: 'fr' | 'en'
  onClose: () => void
}) {
  const t = copy[language]
  const [draft, setDraft] = useState(() => loadDraft(profile))
  const [page, setPage] = useState<GuestbookPage>({ entries: [], cursor: null })
  const [tab, setTab] = useState<'read' | 'write'>('write')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [sending, setSending] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState('')
  const [published, setPublished] = useState<GuestbookEntry | null>(null)
  const mounted = useRef(true)
  async function read(cursor?: number) {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await fetch(endpoint() + (cursor ? `?cursor=${cursor}` : ''), {
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error()
      const next = (await response.json()) as GuestbookPage
      if (!Array.isArray(next.entries)) throw new Error()
      if (mounted.current)
        setPage(old => ({
          ...next,
          entries: [
            ...old.entries,
            ...next.entries.filter(
              entry => !old.entries.some(existing => existing.id === entry.id)
            ),
          ],
        }))
    } catch {
      if (mounted.current) setLoadError(true)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }
  useEffect(() => {
    mounted.current = true
    void read()
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (published) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* Keep the draft in memory. */
    }
  }, [draft, published])
  function edit(update: Partial<GuestbookSubmission>) {
    setError('')
    setDraft(old => ({ ...old, ...update, id: crypto.randomUUID() }))
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError('')
    try {
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
        signal: AbortSignal.timeout(25_000),
      })
      const result = (await response.json()) as { entry?: GuestbookEntry; error?: string }
      if (!response.ok || !result.entry) {
        const reason = result.error
        setError(
          reason === 'rejected' || reason === 'invalid' || reason === 'rate_limited'
            ? t[reason]
            : t.unavailable
        )
        return
      }
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* Best effort. */
      }
      setPublished(result.entry)
      setPage(old => ({
        ...old,
        entries: [result.entry!, ...old.entries.filter(entry => entry.id !== result.entry!.id)],
      }))
    } catch {
      setError(t.unavailable)
    } finally {
      busy.current = false
      setSending(false)
    }
  }
  return (
    <Modal
      className="guestbook-dialog"
      labelledBy="guestbook-title"
      closeLabel={t.close}
      onClose={onClose}
      closeDisabled={sending}
    >
      <header className="guestbook-heading">
        <div>
          <span>{t.eyebrow}</span>
          <h1 id="guestbook-title">{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </header>
      <nav className="guestbook-tabs" aria-label={t.title}>
        {(['read', 'write'] as const).map(value => (
          <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>
            {t[value]}
          </button>
        ))}
      </nav>
      <div className="guestbook-pages">
        <section
          className="guestbook-page guestbook-reading"
          data-active={tab === 'read'}
          aria-label={t.read}
        >
          <span className="guestbook-page-label">01 — {t.read}</span>
          {loading && page.entries.length === 0 && <p role="status">{t.loading}</p>}
          {!loading && !loadError && page.entries.length === 0 && (
            <div className="guestbook-empty">
              <span aria-hidden="true">✧</span>
              <h2>{t.empty}</h2>
              <p>{t.emptyHint}</p>
            </div>
          )}
          {page.entries.map(entry => (
            <article className="guestbook-entry" key={entry.id}>
              <p>{entry.message}</p>
              <footer>
                <AvatarPreview avatar={entry.profile.avatar} color={entry.profile.color} />
                <strong>{entry.profile.name}</strong>
                <time dateTime={new Date(entry.createdAt).toISOString()}>
                  {new Date(entry.createdAt).toLocaleDateString(language, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </time>
              </footer>
            </article>
          ))}
          {loadError && (
            <p role="alert">
              {t.loadError}{' '}
              <button onClick={() => void read(page.cursor ?? undefined)}>{t.retry}</button>
            </p>
          )}
          {page.cursor && !loadError && (
            <button
              className="guestbook-more"
              disabled={loading}
              onClick={() => void read(page.cursor!)}
            >
              {loading ? t.loading : t.more} ↓
            </button>
          )}
        </section>
        <section
          className="guestbook-page guestbook-writing"
          data-active={tab === 'write'}
          aria-label={t.write}
        >
          <span className="guestbook-page-label">02 — {t.write}</span>
          {published ? (
            <div className="guestbook-success" role="status">
              <span aria-hidden="true">✧</span>
              <h2>{t.success}</h2>
              <p>{t.thanks}</p>
              <blockquote>{published.message}</blockquote>
              <strong>— {published.profile.name}</strong>
              <button className="guestbook-submit" onClick={onClose}>
                {t.back} →
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2>{t.invitation}</h2>
              <p>{t.hint}</p>
              <label htmlFor="guestbook-name">{t.name}</label>
              <input
                id="guestbook-name"
                autoComplete="nickname"
                maxLength={24}
                required
                value={draft.profile.name}
                disabled={sending}
                onChange={event =>
                  edit({ profile: { ...draft.profile, name: event.target.value } })
                }
              />
              <label htmlFor="guestbook-message">{t.message}</label>
              <textarea
                id="guestbook-message"
                maxLength={MESSAGE_LIMIT}
                rows={6}
                required
                disabled={sending}
                value={draft.message}
                onChange={event => edit({ message: event.target.value })}
                aria-describedby="guestbook-public"
              />
              <span className="guestbook-count">
                {draft.message.length} / {MESSAGE_LIMIT}
              </span>
              <p className="guestbook-public" id="guestbook-public">
                {t.public}
              </p>
              {error && (
                <p className="guestbook-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="guestbook-submit"
                disabled={sending || !draft.message.trim() || !draft.profile.name.trim()}
              >
                {sending ? t.sending : t.sign} <span aria-hidden="true">↗</span>
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  )
}
