import { describe, expect, it } from 'vitest'
import navigation from '../public/navigation/archipelago.json'
import { canStand, defaultNavigation, stationAt, stations } from './world'
import { parseNavigation } from './navigation-document'
import { findTravelDestination } from './world-travel'

describe('journal travel', () => {
  for (const document of [defaultNavigation, parseNavigation(navigation)]) {
    it.each(stations)('arrives safely on $id in the navigation document', station => {
      const point = findTravelDestination(station, document)
      expect(point).not.toBeNull()
      expect(canStand(point!, document)).toBe(true)
      expect(stationAt(point!, document)?.id).toBe(station.id)
    })
  }
  it('does not send visitors to another island if the destination is removed', () => {
    const station = stations[0]
    const document = {
      ...defaultNavigation,
      zones: defaultNavigation.zones.filter(zone => zone.id !== station.islandZoneId),
    }
    expect(findTravelDestination(station, document)).toBeNull()
  })
})
