import { BiblicalMapCanvas, type BiblicalMapColors } from '@bible-strong/biblical-map'
import type { BiblicalMapPlace } from '@bible-strong/resource-domain/biblical-map'
import { useMemo } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import type { AtlasMapPoint } from './atlas.functions'
import { buildAtlasEntityPath } from './atlasRoutes'
import { ATLAS_MESSAGES } from './messages'

// The map takes the colours of the atlas theme, light or dark.
const COLORS: BiblicalMapColors = {
  sea: 'var(--atlas-sea)',
  land: 'var(--atlas-land)',
  coast: 'var(--atlas-coast)',
  water: 'var(--atlas-water)',
  place: 'var(--atlas-place)',
  accent: 'var(--resource-cta)',
  halo: 'var(--atlas-halo)',
  ink: 'var(--resource-ink)',
  nameHalo: 'var(--atlas-land)',
  control: 'var(--resource-surface-raised)',
  controlInk: 'var(--resource-ink)',
  controlLine: 'var(--resource-line)',
}

/**
 * The places of the Bible on one map, travelled like a map (`@bible-strong/biblical-map`): drag
 * to move, the wheel, a pinch or the buttons to zoom. Every place is a link to its page.
 */
export default function AtlasMap({
  language,
  points,
  focus,
  compact = false,
}: {
  language: ResourceLanguage
  points: AtlasMapPoint[]
  /** A place the map opens on and marks. */
  focus?: AtlasMapPoint
  compact?: boolean
}) {
  const messages = ATLAS_MESSAGES[language]
  const places = useMemo(
    () =>
      points.map(
        ([name, uniqueName, x, y, chapterCount, picture]): BiblicalMapPlace => ({
          name,
          uniqueName,
          x,
          y,
          chapterCount,
          ...(picture ? { picture } : {}),
        })
      ),
    [points]
  )
  // A place opens on a window of this width around it.
  const around = compact ? 420 : 700
  const region = focus
    ? { x: focus[2] - around / 2, y: focus[3] - around * 0.15, width: around, height: around * 0.3 }
    : undefined

  return (
    <BiblicalMapCanvas
      className={`atlas-map ${compact ? 'atlas-map--compact' : ''}`}
      places={places}
      focus={focus?.[1]}
      region={region}
      compact={compact}
      colors={COLORS}
      labels={{
        map: messages.mapLabel,
        zoomIn: messages.mapZoomIn,
        zoomOut: messages.mapZoomOut,
        holyLand: messages.mapHoly,
        whole: messages.mapReset,
      }}
      renderGround={unit => (
        <>
          <use href="/atlas/map.svg#land" className="biblical-map__land" />
          <use href="/atlas/map.svg#lakes" className="biblical-map__lakes" />
          <use
            href="/atlas/map.svg#rivers"
            className="biblical-map__rivers"
            style={{ strokeWidth: 1.4 * unit }}
          />
        </>
      )}
      placeHref={uniqueName => buildAtlasEntityPath(language, uniqueName)}
    />
  )
}
