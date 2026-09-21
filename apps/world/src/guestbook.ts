import { defaultNavigation, inPolygon, type NavigationDocument } from './world'
import { parseProfile, type AvatarProfile } from './avatar-profile'

export const MESSAGE_LIMIT = 500
export type GuestbookSubmission = { id: string; profile: AvatarProfile; message: string }
export type GuestbookEntry = GuestbookSubmission & { createdAt: number }
export type GuestbookPage = { entries: GuestbookEntry[]; cursor: number | null }

/** The whole central island activates the book; connecting bridges stay separate. */
export function nearGuestbook(
  point: { x: number; y: number },
  navigation: NavigationDocument = defaultNavigation
) {
  return navigation.zones.some(
    zone => zone.id === 'land-0' && zone.kind === 'allowed' && inPolygon(point, zone.points)
  )
}

export function parseSubmission(value: unknown): GuestbookSubmission | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  const profile = parseProfile(data.profile)
  if (
    !profile ||
    typeof data.id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(data.id) ||
    typeof data.message !== 'string'
  )
    return null
  const message = data.message.trim()
  if (
    !message ||
    message.length > MESSAGE_LIMIT ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)
  )
    return null
  return { id: data.id, profile, message }
}
