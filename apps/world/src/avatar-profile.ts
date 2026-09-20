export const PROFILE_KEY = 'bible-strong.world.profile.v1'
export const AVATARS = [
  { id: 'nova', name: 'Blob', image: './assets/avatars/blob/thumbnail.png' },
] as const
export type AvatarProfile = { avatar: 'nova'; name: string; color: string }
export const DEFAULT_PROFILE: AvatarProfile = { avatar: 'nova', name: '', color: '#73cdd0' }
export const NAME_LIMIT = 24

export function parseProfile(value: unknown): AvatarProfile | null {
  if (!value || typeof value !== 'object') return null
  const profile = value as Record<string, unknown>
  if (
    profile.avatar !== 'nova' ||
    typeof profile.name !== 'string' ||
    typeof profile.color !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(profile.color)
  )
    return null
  const name = profile.name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, NAME_LIMIT)
  if (!name) return null
  return { avatar: 'nova', name, color: profile.color.toLowerCase() }
}

export function loadProfile(): AvatarProfile | null {
  try {
    return parseProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null'))
  } catch {
    return null
  }
}

export function saveProfile(profile: AvatarProfile): boolean {
  const valid = parseProfile(profile)
  if (!valid) return false
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(valid))
    return true
  } catch {
    return false
  }
}
