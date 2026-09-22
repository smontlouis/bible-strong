import { Modal } from './Modal'
import { useEffect, useRef, useState } from 'react'
import { AvatarPreview } from './AvatarEditor'
import { readSignature, rememberSignature } from './guestbook-local'
import { GuestbookWall } from './GuestbookWall'
import { NOTE_COLORS, isNoteColor } from './guestbook-layout'
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
    title: 'Le tableau des petits mots',
    eyebrow: 'UNE TRACE DE TON PASSAGE',
    subtitle: 'Un monde à explorer. Des souvenirs à partager.',
    read: 'Vos petits mots',
    write: 'À ton tour',
    invitation: 'Un petit mot avant de repartir ?',
    hint: 'Un encouragement, une découverte, un témoignage…',
    name: 'Ton avatar',
    alreadySigned: 'Ton avatar a déjà laissé son petit mot. Merci !',
    message: 'Ton message',
    sign: 'Ajouter mon post-it',
    color: 'Couleur du post-it',
    colors: ['Jaune', 'Rose', 'Menthe', 'Lavande', 'Bleu'],
    explore: 'Explorer le mur',
    sending: 'Envoi en cours…',
    close: 'Fermer',
    empty: 'Le premier petit mot sera le tien.',
    emptyHint: 'Laisse le premier souvenir de cette aventure.',
    more: 'Lire les mots précédents',
    loading: 'Ouverture du mur…',
    retry: 'Réessayer',
    unavailable:
      'Impossible d’envoyer pour le moment. Ton texte est conservé, réessaie dans un instant.',
    rejected:
      'Ce mot ne peut pas être publié tel quel. Vérifie le message pour garder ce tableau accueillant pour tous.',
    rate_limited: 'Un petit instant… Réessaie dans une minute.',
    invalid: 'Écris un message de 500 caractères maximum.',
    loadError: 'Le mur est momentanément indisponible.',
    success: 'Ta trace est ici.',
    thanks: 'Merci, tu fais maintenant partie de cette aventure !',
    back: 'Revenir au monde',
  },
  en: {
    title: 'The community board',
    eyebrow: 'LEAVE A LITTLE MEMORY',
    subtitle: 'A world to explore. Memories to share.',
    read: 'Your little notes',
    write: 'Your turn',
    invitation: 'A little note before you go?',
    hint: 'An encouragement, a discovery, a story…',
    name: 'Your avatar',
    alreadySigned: 'Your avatar has already left a note. Thank you!',
    message: 'Your message',
    sign: 'Add my note',
    color: 'Note color',
    colors: ['Yellow', 'Pink', 'Mint', 'Lavender', 'Blue'],
    explore: 'Explore the wall',
    sending: 'Sending…',
    close: 'Close',
    empty: 'The first little note is yours.',
    emptyHint: 'Leave the first memory of this adventure.',
    more: 'Read earlier notes',
    loading: 'Opening the wall…',
    retry: 'Try again',
    unavailable: 'Unable to send right now. Your text is saved; please try again shortly.',
    rejected:
      'This note cannot be published as it is. Please check your message to keep this board welcoming for everyone.',
    rate_limited: 'Just a moment… Please try again in a minute.',
    invalid: 'Enter a message of up to 500 characters.',
    loadError: 'The wall is temporarily unavailable.',
    success: 'Your memory is here.',
    thanks: 'Thank you for being part of this adventure!',
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
      return {
        id:
          JSON.stringify(savedProfile) === JSON.stringify(profile) ? value.id : crypto.randomUUID(),
        message: value.message.slice(0, MESSAGE_LIMIT),
        profile,
        noteColor: isNoteColor(value.noteColor) ? value.noteColor : 'butter',
      }
  } catch {
    /* Storage can be unavailable. The in-memory draft remains usable. */
  }
  return { id: crypto.randomUUID(), message: '', profile, noteColor: 'butter' }
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
  const [signedId, setSignedId] = useState(() => readSignature())
  const [writing, setWriting] = useState(false)
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
      const entries: GuestbookEntry[] = []
      let nextCursor = cursor
      do {
        const response = await fetch(endpoint() + (nextCursor ? `?cursor=${nextCursor}` : ''), {
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) throw new Error()
        const next = (await response.json()) as GuestbookPage
        if (!Array.isArray(next.entries)) throw new Error()
        entries.push(...next.entries)
        nextCursor = next.cursor ?? undefined
        if (!mounted.current) return
      } while (nextCursor)
      if (mounted.current)
        setPage(old => ({
          entries: [
            ...entries,
            ...old.entries.filter(entry => !entries.some(next => next.id === entry.id)),
          ],
          cursor: null,
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
    if (published || signedId) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* Keep the draft in memory. */
    }
  }, [draft, published, signedId])
  useEffect(() => {
    function syncSignature() {
      const id = readSignature()
      if (id) {
        setSignedId(id)
        setWriting(false)
      }
    }
    window.addEventListener('storage', syncSignature)
    return () => window.removeEventListener('storage', syncSignature)
  }, [])
  function edit(update: Partial<Pick<GuestbookSubmission, 'message' | 'noteColor'>>) {
    setError('')
    setDraft(old => ({ ...old, ...update, id: crypto.randomUUID() }))
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const existingSignature = signedId || readSignature()
    if (existingSignature) {
      setSignedId(existingSignature)
      setWriting(false)
      return
    }
    busy.current = true
    setSending(true)
    setError('')
    try {
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, profile }),
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
      rememberSignature(result.entry.id)
      setSignedId(result.entry.id)
      setPublished(result.entry)
      setWriting(false)
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
      <div className="guestbook-body">
        <GuestbookWall entries={page.entries} language={language} focusId={published?.id} />
        {loading && (
          <p className="guestbook-notice" role="status">
            {t.loading}
          </p>
        )}
        {loadError && (
          <p className="guestbook-notice" role="alert">
            {t.loadError}{' '}
            <button type="button" onClick={() => void read()}>
              {t.retry}
            </button>
          </p>
        )}
        {!loading && !loadError && !page.entries.length && !writing && !signedId && (
          <div className="guestbook-empty">
            <h2>{t.empty}</h2>
            <p>{t.emptyHint}</p>
          </div>
        )}
        {signedId && (
          <p className="guestbook-published" role="status">
            ✧ {published ? t.thanks : t.alreadySigned}
          </p>
        )}
        {!writing && !signedId && (
          <button type="button" className="guestbook-add" onClick={() => setWriting(true)}>
            + {t.write}
          </button>
        )}
        {writing && !signedId && (
          <section className="guestbook-composer" aria-label={t.write}>
            <button
              type="button"
              className="guestbook-composer-close"
              aria-label={t.explore}
              disabled={sending}
              onClick={() => setWriting(false)}
            >
              ×
            </button>
            <form onSubmit={submit}>
              <h2>{t.invitation}</h2>
              <p>{t.hint}</p>
              <div className="guestbook-draft" data-color={draft.noteColor ?? 'butter'}>
                <span className="guestbook-tape" aria-hidden="true" />
                <label htmlFor="guestbook-message">{t.message}</label>
                <textarea
                  id="guestbook-message"
                  maxLength={MESSAGE_LIMIT}
                  rows={Math.max(
                    4,
                    draft.message
                      .split('\n')
                      .reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / 24)), 0)
                  )}
                  required
                  disabled={sending}
                  value={draft.message}
                  placeholder={t.hint}
                  onChange={event => edit({ message: event.target.value })}
                />
                <span className="guestbook-count">
                  {draft.message.length} / {MESSAGE_LIMIT}
                </span>
                <span className="guestbook-author-label">{t.name}</span>
                <div className="guestbook-author">
                  <AvatarPreview avatar={profile.avatar} color={profile.color} />
                  <strong>{profile.name}</strong>
                </div>
              </div>
              <fieldset className="guestbook-colors" disabled={sending}>
                <legend>{t.color}</legend>
                {NOTE_COLORS.map((color, index) => (
                  <label key={color} data-color={color} title={t.colors[index]}>
                    <input
                      type="radio"
                      name="note-color"
                      value={color}
                      checked={(draft.noteColor ?? 'butter') === color}
                      onChange={() => edit({ noteColor: color })}
                    />
                    <span className="guestbook-swatch" aria-hidden="true" />
                    <span className="guestbook-sr-only">{t.colors[index]}</span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p className="guestbook-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="guestbook-submit"
                disabled={sending || !draft.message.trim() || !profile.name.trim()}
              >
                {sending ? t.sending : t.sign} <span aria-hidden="true">↗</span>
              </button>
            </form>
          </section>
        )}
      </div>
    </Modal>
  )
}
