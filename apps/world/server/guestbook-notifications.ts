import type { GuestbookEntry } from '../src/guestbook'
import {
  hostingerConfigured,
  sendHostingerNotification,
  type HostingerMailEnv,
} from './hostinger-mail'
export interface NotificationEnv extends HostingerMailEnv {
  GUESTBOOK_NOTIFICATION_TO?: string
  GUESTBOOK_NOTIFICATION_FROM?: string
  GUESTBOOK_ADMIN_URL?: string
  // Optional alternative private transport; Hostinger is used when absent.
  GUESTBOOK_MAILER?: { fetch(request: Request): Promise<Response> }
}
export function notificationsConfigured(env: NotificationEnv) {
  try {
    return Boolean(
      (env.GUESTBOOK_MAILER || hostingerConfigured(env)) &&
      env.GUESTBOOK_NOTIFICATION_TO &&
      env.GUESTBOOK_NOTIFICATION_FROM &&
      env.GUESTBOOK_ADMIN_URL &&
      new URL(env.GUESTBOOK_ADMIN_URL).protocol === 'https:'
    )
  } catch {
    return false
  }
}
export function notificationEmail(entry: GuestbookEntry, env: NotificationEnv) {
  const link = new URL(env.GUESTBOOK_ADMIN_URL!)
  link.searchParams.set('message', entry.id)
  return {
    from: env.GUESTBOOK_NOTIFICATION_FROM,
    to: env.GUESTBOOK_NOTIFICATION_TO,
    subject: 'Bible Strong World — nouveau message dans le livre d’or',
    text: [
      'Un nouveau message a été publié dans le livre d’or.',
      '',
      entry.profile.name,
      new Date(entry.createdAt).toISOString(),
      '',
      entry.message,
      '',
      `Gérer ce message : ${link.href}`,
    ].join('\n'),
  }
}
export function retryDelay(attempts: number) {
  return Math.min(3_600_000, 30_000 * 2 ** Math.min(attempts, 7))
}
export async function deliverNotification(
  entry: GuestbookEntry,
  env: NotificationEnv
): Promise<'sent' | 'unconfigured' | 'failed'> {
  if (!notificationsConfigured(env)) return 'unconfigured'
  if (!env.GUESTBOOK_MAILER)
    return sendHostingerNotification(entry.id, notificationEmail(entry, env), env)
  try {
    const response = await env.GUESTBOOK_MAILER!.fetch(
      new Request('https://guestbook-mailer.internal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `guestbook:${entry.id}` },
        body: JSON.stringify(notificationEmail(entry, env)),
        signal: AbortSignal.timeout(10_000),
      })
    )
    if (!response.ok) {
      await response.body?.cancel()
      return 'failed'
    }
    const result = (await response.json()) as { messageId?: unknown }
    return typeof result.messageId === 'string' && result.messageId.length > 0 ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}
