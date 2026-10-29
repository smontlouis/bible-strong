'use dom'

import {
  BiblicalMapCanvas,
  type BiblicalMapColors,
  type BiblicalMapLabels,
} from '@bible-strong/biblical-map'
import BiblicalMapGround from '@bible-strong/biblical-map/ground'
import type { BiblicalMapPlace, BiblicalMapView } from '@bible-strong/resource-domain/biblical-map'

/**
 * The map of the places of the Bible travelled with the fingers, drawn by the web view: the map
 * of the public atlas, which a browser redraws on every move (ADR-0091).
 */
export default function BiblicalMapDOM({
  places,
  focus,
  highlighted,
  region,
  colors,
  labels,
  onOpenPlace,
}: {
  dom?: import('expo/dom').DOMProps
  places: BiblicalMapPlace[]
  focus?: string
  highlighted?: string[]
  region?: BiblicalMapView
  colors: BiblicalMapColors
  labels: BiblicalMapLabels
  onOpenPlace: (uniqueName: string) => void
}) {
  return (
    <BiblicalMapCanvas
      places={places}
      focus={focus}
      highlighted={highlighted}
      region={region}
      colors={colors}
      labels={labels}
      renderGround={unit => <BiblicalMapGround unit={unit} />}
      onOpenPlace={onOpenPlace}
      style={{
        position: 'fixed',
        inset: 0,
        fontFamily: '-apple-system, system-ui, Roboto, sans-serif',
      }}
    />
  )
}
