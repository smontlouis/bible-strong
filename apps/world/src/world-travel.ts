import {
  findSafePosition,
  stationAt,
  type NavigationDocument,
  type Point,
  type Station,
} from './world'

/** Arrival must remain on the requested island, including with edited navigation. */
export function findTravelDestination(
  station: Station,
  navigation: NavigationDocument
): Point | null {
  const destination = findSafePosition({ x: station.x, y: station.y }, navigation)
  return destination && stationAt(destination, navigation)?.id === station.id ? destination : null
}
