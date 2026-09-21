import { useEffect, useRef, useState } from 'react'
import type { AdminEntry, AdminFilter, AdminPage } from './guestbook-admin'
import './guestbook-admin.css'
const copy = {
  fr: {
    title: 'Le livre d’or',
    subtitle: 'Administration',
    all: 'Tous',
    visible: 'En ligne',
    removed: 'Retirés',
    refresh: 'Actualiser',
    back: 'Retour au monde',
    remove: 'Retirer du livre',
    restore: 'Restaurer',
    removing: 'Enregistrement…',
    empty: 'Aucun message ici.',
    loading: 'Chargement…',
    error: 'Impossible de charger les messages. Réessaie.',
    unauthorized:
      'Accès réservé. Connecte-toi avec ton adresse administrateur via Cloudflare Access.',
    configuration:
      'Les emails ne sont pas encore configurés. Les nouvelles notifications sont conservées en attente.',
    ready: 'Envoi des notifications configuré.',
    pending: 'notifications en attente',
    pendingOne: 'notification en attente',
    removedState: 'Retiré',
    queued: 'Email en attente',
    sent: 'Email transmis',
    legacy: 'Message antérieur aux notifications',
    more: 'Messages précédents',
    changed: 'Modification enregistrée.',
    failed: 'La modification a échoué. Réessaie.',
    detail: 'Message sélectionné',
    clear: 'Voir tous les messages',
    note: 'Retirer masque immédiatement le message du livre public. Tu peux le restaurer à tout moment.',
  },
  en: {
    title: 'The guestbook',
    subtitle: 'Administration',
    all: 'All',
    visible: 'Published',
    removed: 'Removed',
    refresh: 'Refresh',
    back: 'Back to the world',
    remove: 'Remove from book',
    restore: 'Restore',
    removing: 'Saving…',
    empty: 'No messages here.',
    loading: 'Loading…',
    error: 'Unable to load messages. Please try again.',
    unauthorized:
      'Restricted access. Sign in with your administrator email through Cloudflare Access.',
    configuration: 'Email is not configured yet. New notifications are saved for later delivery.',
    ready: 'Notification delivery is configured.',
    pending: 'notifications pending',
    pendingOne: 'notification pending',
    removedState: 'Removed',
    queued: 'Email pending',
    sent: 'Email handed off',
    legacy: 'Message predates notifications',
    more: 'Earlier messages',
    changed: 'Change saved.',
    failed: 'Unable to save this change. Please try again.',
    detail: 'Selected message',
    clear: 'View all messages',
    note: 'Removing immediately hides the message from the public book. You can restore it at any time.',
  },
}
export default function GuestbookAdmin() {
  const [language, setLanguage] = useState<'fr' | 'en'>('fr')
  const t = copy[language]
  useEffect(() => {
    document.documentElement.lang = language
    document.title = `${copy[language].title} · ${copy[language].subtitle}`
  }, [language])
  const [filter, setFilter] = useState<AdminFilter>('all')
  const [selected, setSelected] = useState(() =>
    new URLSearchParams(location.search).get('message')
  )
  const [page, setPage] = useState<AdminPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<'error' | 'unauthorized' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<'changed' | 'failed' | null>(null)
  const generation = useRef(0)
  const mutation = useRef(false)
  async function load(cursor?: number) {
    const current = ++generation.current
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ filter })
      if (selected) query.set('message', selected)
      if (cursor) query.set('cursor', String(cursor))
      const response = await fetch(`/api/guestbook/admin?${query}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        if (current === generation.current)
          setError(response.status === 401 || response.status === 403 ? 'unauthorized' : 'error')
        return
      }
      const next = (await response.json()) as AdminPage
      if (current === generation.current)
        setPage(old => ({
          ...next,
          entries: cursor && old ? [...old.entries, ...next.entries] : next.entries,
        }))
    } catch {
      if (current === generation.current) setError('error')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }
  useEffect(() => {
    setPage(null)
    void load()
    return () => {
      generation.current++
    }
  }, [filter, selected])
  async function toggle(entry: AdminEntry) {
    if (mutation.current) return
    mutation.current = true
    setBusy(entry.id)
    setNotice(null)
    try {
      const response = await fetch('/api/guestbook/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guestbook-Admin': '1' },
        body: JSON.stringify({ id: entry.id, removed: entry.removedAt === null }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error()
      setNotice('changed')
      await load()
    } catch {
      setNotice('failed')
    } finally {
      mutation.current = false
      setBusy(null)
    }
  }
  return (
    <main className="guestbook-admin">
      <header>
        <div>
          <span className="admin-eyebrow">BIBLE STRONG · {t.subtitle}</span>
          <h1>{t.title}</h1>
        </div>
        <select
          aria-label="Language"
          value={language}
          onChange={e => setLanguage(e.target.value as 'fr' | 'en')}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </header>
      <a href="/">← {t.back}</a>
      {page && (
        <aside className="admin-delivery">
          <strong>{page.notificationsConfigured ? t.ready : t.configuration}</strong>
          <span>
            {page.pendingNotifications} {page.pendingNotifications === 1 ? t.pendingOne : t.pending}
          </span>
        </aside>
      )}
      <p>{t.note}</p>
      <nav aria-label={t.subtitle}>
        {(['all', 'visible', 'removed'] as const).map(value => (
          <button
            key={value}
            disabled={busy !== null}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t[value]}
          </button>
        ))}
        <button disabled={loading || busy !== null} onClick={() => void load()}>
          {t.refresh}
        </button>
      </nav>
      {selected && (
        <p>
          {t.detail} ·{' '}
          <button
            disabled={busy !== null}
            onClick={() => {
              setSelected(null)
              history.replaceState(null, '', '/admin-guestbook')
            }}
          >
            {t.clear}
          </button>
        </p>
      )}
      {notice && <p role="status">{t[notice]}</p>}
      {error && <p role="alert">{t[error]}</p>}
      {loading && <p role="status">{t.loading}</p>}
      {!loading && !error && page?.entries.length === 0 && <p>{t.empty}</p>}
      <div className="admin-entries">
        {page?.entries.map(entry => (
          <article key={entry.id} data-removed={entry.removedAt !== null}>
            <header>
              <strong>{entry.profile.name}</strong>
              <time dateTime={new Date(entry.createdAt).toISOString()}>
                {new Date(entry.createdAt).toLocaleString(language)}
              </time>
            </header>
            <p className="admin-message">{entry.message}</p>
            <footer>
              <span className="admin-status">
                {entry.removedAt === null ? t.visible : t.removedState} · {t[entry.notification]}
              </span>
              <button
                className={entry.removedAt === null ? 'admin-remove' : 'admin-restore'}
                disabled={busy !== null}
                onClick={() => void toggle(entry)}
              >
                {busy === entry.id ? t.removing : entry.removedAt === null ? t.remove : t.restore}
              </button>
            </footer>
          </article>
        ))}
      </div>
      {page?.cursor && (
        <button disabled={loading || busy !== null} onClick={() => void load(page.cursor!)}>
          {t.more} ↓
        </button>
      )}
    </main>
  )
}
