import { getDailyCollectionUri } from './dailyReadingFormat'

/**
 * The Web keeps no copy of its own: a collection file never changes under its address and is
 * cached by the browser for a year, so reading it again costs nothing once it has been read.
 */
export type KeptCollection = { hash: string; text: string }

export const readKeptCollection = async (_id: string): Promise<KeptCollection | undefined> =>
  undefined

const sha256Hex = async (text: string) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export const downloadCollection = async (id: string, hash: string): Promise<string> => {
  const response = await fetch(getDailyCollectionUri(id, hash))
  if (!response.ok) throw new Error(`DAILY_READING_DOWNLOAD_${response.status}`)
  const text = await response.text()
  if (globalThis.crypto?.subtle && !(await sha256Hex(text)).startsWith(hash))
    throw new Error('DAILY_READING_INTEGRITY')
  return text
}
