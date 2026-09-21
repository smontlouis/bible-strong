export interface HostingerMailEnv {
  HOSTINGER_MAIL_API_TOKEN?: string
  HOSTINGER_MAILBOX_ID?: string
}

export function hostingerConfigured(env: HostingerMailEnv) {
  return Boolean(
    env.HOSTINGER_MAIL_API_TOKEN?.trim() && /^AC[a-zA-Z0-9]+$/.test(env.HOSTINGER_MAILBOX_ID || '')
  )
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Missing mail response')
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 65_536) {
      await reader.cancel()
      throw new Error('Oversized mail response')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Called only by the guestbook's serialized alarm, never through a public send route. */
export async function sendHostingerNotification(
  id: string,
  mail: { to?: string; subject: string; text: string },
  env: HostingerMailEnv,
  request: typeof fetch = fetch
): Promise<'sent' | 'failed'> {
  if (!hostingerConfigured(env) || !mail.to) return 'failed'
  const base = `https://api.mail.hostinger.com/api/v1/mailboxes/${env.HOSTINGER_MAILBOX_ID}`
  const subject = `${mail.subject} [guestbook:${id}]`
  const init = {
    method: 'POST',
    redirect: 'error' as const,
    headers: {
      Authorization: `Bearer ${env.HOSTINGER_MAIL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  }
  try {
    // Hostinger has no documented idempotency key. Reconcile its Sent copy before
    // retrying after a lost acknowledgement. This reduces, but cannot eliminate,
    // duplicates if sending succeeds without a searchable Sent copy.
    const found = await request(`${base}/folders/INBOX.Sent/messages/search?perPage=1`, {
      ...init,
      // Multiple criteria match unrelated messages on Hostinger. Search only the
      // unique entry ID, then verify the full subject below before acknowledging.
      body: JSON.stringify({ subject: id }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!found.ok) {
      await found.body?.cancel()
      return 'failed'
    }
    const result = await boundedJson(found)
    if (!result || typeof result !== 'object' || !('data' in result) || !Array.isArray(result.data))
      return 'failed'
    if (result.data.length > 0) {
      return result.data.some(row => row && row.subject === subject && Number.isInteger(row.uid))
        ? 'sent'
        : 'failed'
    }
    const response = await request(`${base}/send`, {
      ...init,
      body: JSON.stringify({
        to: [mail.to],
        displayName: 'Bible Strong World',
        subject,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    await response.body?.cancel()
    return response.status === 204 ? 'sent' : 'failed'
  } catch {
    // Neither provider bodies, credentials nor visitor messages belong in logs.
    return 'failed'
  }
}
