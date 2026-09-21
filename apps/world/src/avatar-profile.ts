export const AVATAR_COLORS = [
  '#ffffff',
  '#73cdd0',
  '#7398f2',
  '#b39ae9',
  '#f3a3cb',
  '#f09075',
  '#f7d45d',
  '#a2ce86',
]
export const PROFILE_KEY = 'bible-strong.world.profile.v1'
export const AVATARS = [
  { id: 'nova', name: 'Bean', image: '/assets/avatars/blob/thumbnail.png' },
  { id: 'short-slime', name: 'Slime', image: '/assets/avatars/short-slime/thumbnail.png' },
  { id: 'rounded-square', name: 'Cubee', image: '/assets/avatars/rounded-square/thumbnail.png' },
  { id: 'cloud', name: 'Cloud', image: '/assets/avatars/cloud/thumbnail.png' },
  { id: 'triangle', name: 'Triangle', image: '/assets/avatars/triangle/thumbnail.png' },
] as const
export type AvatarId = (typeof AVATARS)[number]['id']
export type AvatarProfile = { avatar: AvatarId; name: string; color: string }
export const DEFAULT_PROFILE: AvatarProfile = { avatar: 'nova', name: '', color: '#73cdd0' }
export const NAME_LIMIT = 24

const BIBLICAL_NAMES = [
  'Noah', 'Esther', 'Ruth', 'Daniel', 'Hannah', 'David', 'Sarah', 'Caleb',
  'Miriam', 'Joshua', 'Abigail', 'Elijah', 'Deborah', 'Samuel', 'Lydia', 'Ezra',
  'Rachel', 'Isaac', 'Naomi', 'Jonah', 'Martha', 'Seth', 'Rebecca', 'Levi',
]
const EXPLORER_ADJECTIVES = [
  'Joyful', 'Brave', 'Kind', 'Faithful', 'Hopeful', 'Gentle', 'Patient', 'Cheerful',
  'Peaceful', 'Grateful', 'Humble', 'Curious', 'Steadfast', 'Generous', 'Wise', 'Radiant',
]

/** English suggestions in both interface languages, chosen during first-visit initialization. */
export function generateExplorerName() {
  const name = BIBLICAL_NAMES[Math.floor(Math.random() * BIBLICAL_NAMES.length)]
  const adjective = EXPLORER_ADJECTIVES[Math.floor(Math.random() * EXPLORER_ADJECTIVES.length)]
  return `${adjective} ${name}`
}

export function generateExplorerProfile(): AvatarProfile {
  return {
    name: generateExplorerName(),
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)].id,
    color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  }
}

export function parseProfile(value: unknown): AvatarProfile | null {
  if (!value || typeof value !== 'object') return null
  const profile = value as Record<string, unknown>
  if (
    !AVATARS.some(avatar => avatar.id === profile.avatar) ||
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
  return { avatar: profile.avatar as AvatarId, name, color: profile.color.toLowerCase() }
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
