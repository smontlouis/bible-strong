// The worlds of Bible Strong World and the journeys between them (docs/adr/0085). Each world
// lives at its own address and is loaded on demand; portals on the maps lead from one to another.
import type { Language } from './language'

export const universes = {
  archipelago: {
    path: '/',
    name: { fr: 'L’archipel', en: 'The archipelago' },
    /** Shown while the screen is covered during a journey to this world. */
    travel: { fr: 'Retour au présent', en: 'Back to the present' },
  },
  'valence-1876': {
    path: '/valence-1876',
    name: { fr: 'Valence 1876', en: 'Valence 1876' },
    travel: { fr: 'Octobre 1876 · le train de Lyon entre en gare', en: 'October 1876 · the Lyon train pulls in' },
  },
} as const satisfies Record<string, { path: string; name: Record<Language, string>; travel: Record<Language, string> }>

export type UniverseId = keyof typeof universes
export const universeIds = Object.keys(universes) as UniverseId[]

/** The visitor came through the portal that leads from `from` to the current world. */
export type Arrival = { from: UniverseId }
export type ScreenPoint = { x: number; y: number }

/** What the host gives each world. */
export type UniverseProps = {
  arrival: Arrival | null
  /** Starts a journey; the covering animation grows from `origin`, in page pixels. */
  onTravel: (to: UniverseId, origin?: ScreenPoint) => void
  /** The world is drawn, or failed, and may be uncovered. */
  onReady: () => void
}

/** The world an address opens. Unknown addresses fall back to the archipelago, as the Worker does. */
export function universeAt(pathname: string): UniverseId {
  const path = pathname.replace(/\/+$/, '') || '/'
  return universeIds.find(id => universes[id].path === path) ?? 'archipelago'
}

/** Relative asset URLs resolve against the page, so world addresses never end with a slash. */
export function canonicalPath(pathname: string) {
  const id = universeAt(pathname)
  return id === 'archipelago' ? pathname : universes[id].path
}
