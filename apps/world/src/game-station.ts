import { nearGuestbook } from './guestbook'
import { defaultNavigation, type NavigationDocument, type Point } from './world'

/** The fern immediately west of the central island's northern bridge. */
export const GAME_STATION = { x: 745, y: 350, width: 52, height: 72 } as const
export const GAME_STATION_RADIUS = 70
export function nearGameStation(point: Point, navigation: NavigationDocument = defaultNavigation) {
  return (
    nearGuestbook(point, navigation) &&
    Math.hypot(point.x - GAME_STATION.x, point.y - GAME_STATION.y) <= GAME_STATION_RADIUS
  )
}
