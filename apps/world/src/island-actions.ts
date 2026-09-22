import { nearGameStation } from './game-station'
import { nearGuestbook } from './guestbook'
import { defaultNavigation, stationAt, type NavigationDocument, type Point } from './world'

/** Fixed visual centers in the map's original 1671 × 941 coordinate system. */
export const islandActions = [
  { id: 'story', x: 836, y: 455 },
  { id: 'games', x: 760, y: 340 },
  { id: 'guestbook', x: 950, y: 375 },
  { id: 'dictionary', x: 350, y: 275 },
  { id: 'lexicon', x: 875, y: 215 },
  { id: 'references', x: 1335, y: 270 },
  { id: 'themes', x: 310, y: 710 },
  { id: 'comparison', x: 836, y: 770 },
  { id: 'commentaries', x: 1390, y: 705 },
] as const

export type IslandActionId = (typeof islandActions)[number]['id']

export const ISLAND_ACTION_RADIUS = 105

export function nearIslandAction(
  point: Point,
  id: IslandActionId,
  navigation: NavigationDocument = defaultNavigation
) {
  if (id === 'games') return nearGameStation(point, navigation)
  const anchor = islandActions.find(action => action.id === id)
  const radius = id === 'guestbook' ? 70 : ISLAND_ACTION_RADIUS
  if (!anchor || Math.hypot(point.x - anchor.x, point.y - anchor.y) > radius) {
    return false
  }
  if (id === 'guestbook' || id === 'story') return nearGuestbook(point, navigation)
  return stationAt(point, navigation)?.id === id
}
