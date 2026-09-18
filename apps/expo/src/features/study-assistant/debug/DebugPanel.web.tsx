import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startDebugSession } from './client.web'
import type { DebugEntry, DebugSession } from './trace'
import './debug.css'
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const groups = ['all', 'jev', 'gloo', 'tools', 'context'] as const
export default function DebugPanel({
  session,
  entries,
  busy,
  onSession,
  onClear,
}: {
  session: DebugSession | null
  entries: DebugEntry[]
  busy: boolean
  onSession: (session: DebugSession) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState(''),
    [connecting, setConnecting] = useState(false)
  const [group, setGroup] = useState<(typeof groups)[number]>('all'),
    [copied, setCopied] = useState(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  const activate = async () => {
    const signal = lifetime.current?.signal
    if (!signal || signal.aborted) return
    setConnecting(true)
    try {
      const next = await startDebugSession(AbortSignal.any([signal, AbortSignal.timeout(20000)]))
      if (!signal.aborted) {
        onSession(next)
        setError('')
      }
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'DEBUG_UNAVAILABLE')
    } finally {
      if (!signal.aborted) setConnecting(false)
    }
  }
  const decision = record(record(entries.find(e => e.stage === 'jev_decision')?.data).assessment)
  const summary = record(entries.findLast(e => e.stage === 'summary')?.data)
  const visible = entries.filter(
    e =>
      group === 'all' ||
      (group === 'jev' && e.stage.startsWith('jev_')) ||
      (group === 'gloo' && e.stage.startsWith('model_')) ||
      (group === 'tools' && /tool|resource|routing/.test(e.stage)) ||
      (group === 'context' && ['request', 'base_prompt', 'setup'].includes(e.stage))
  )
  return (
    <section className="bs-debug" aria-label={t('assistant.debug.title')}>
      <header>
        <div>
          <strong>{t('assistant.debug.title')}</strong>
          <span>
            Cloudflare · {session ? t('assistant.debug.active') : t('assistant.debug.inactive')}
          </span>
        </div>
        {!!entries.length && (
          <button type="button" disabled={busy} onClick={onClear}>
            {t('assistant.debug.clear')}
          </button>
        )}
      </header>
      <p className="bs-debug-note">{t('assistant.debug.description')}</p>
      {!session ? (
        <div className="bs-debug-auth">
          {error && (
            <p role="alert">
              {t(
                error === 'DEBUG_ACCESS_DENIED'
                  ? 'assistant.debug.denied'
                  : 'assistant.debug.unavailable'
              )}
            </p>
          )}
          <button type="button" disabled={connecting || busy} onClick={() => void activate()}>
            {t(connecting ? 'assistant.debug.connecting' : 'assistant.debug.activate')}
          </button>
        </div>
      ) : (
        <>
          <div className="bs-debug-session">
            {t('assistant.debug.until')}{' '}
            {new Date(session.expiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            <span>{t('assistant.debug.memoryOnly')}</span>
          </div>
          <div className="bs-debug-metrics">
            <strong>{String(decision.decision || '—')}</strong>
            <span>
              JEV{' '}
              {String(summary.jevCalls ?? entries.filter(e => e.stage === 'jev_request').length)}
            </span>
            <span>
              Gloo{' '}
              {String(
                summary.modelCalls ?? entries.filter(e => e.stage === 'model_request').length
              )}
            </span>
            <span>
              {t('assistant.debug.tools')}{' '}
              {String(summary.toolCalls ?? entries.filter(e => e.stage === 'tool_request').length)}
            </span>
            <span>
              {Number(summary.elapsedMs ?? entries.at(-1)?.elapsedMs ?? 0).toLocaleString()} ms
            </span>
          </div>
          <nav aria-label={t('assistant.debug.filters')}>
            {groups.map(value => (
              <button
                type="button"
                key={value}
                aria-pressed={group === value}
                onClick={() => setGroup(value)}
              >
                {t(`assistant.debug.${value}`)}
              </button>
            ))}
            <button
              type="button"
              className="bs-debug-copy"
              disabled={!entries.length}
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(entries, null, 2)).then(
                  () => setCopied(true),
                  () => setCopied(false)
                )
              }}
            >
              {t(copied ? 'assistant.debug.copied' : 'assistant.debug.copy')}
            </button>
          </nav>
          <div className="bs-debug-events">
            {!entries.length ? (
              <p>{t('assistant.debug.nextRequest')}</p>
            ) : (
              visible.map(entry => (
                <details key={entry.sequence} className="bs-debug-event">
                  <summary>
                    <span>{entry.sequence.toString().padStart(2, '0')}</span>
                    <strong>{entry.stage}</strong>
                    <time>{entry.elapsedMs.toLocaleString()} ms</time>
                  </summary>
                  <pre>{JSON.stringify(entry.data, null, 2)}</pre>
                </details>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}
