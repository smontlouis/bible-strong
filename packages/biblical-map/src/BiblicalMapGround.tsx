import { BIBLICAL_MAP_LAKES, BIBLICAL_MAP_LAND, BIBLICAL_MAP_RIVERS } from './groundPaths'

/**
 * The ground drawn inline, for a map that cannot fetch the site's `map.svg`: the application's
 * DOM component. Its classes take the colours of the map.
 */
export default function BiblicalMapGround({ unit }: { unit: number }) {
  return (
    <>
      <path d={BIBLICAL_MAP_LAND} className="biblical-map__land" />
      <path d={BIBLICAL_MAP_LAKES} className="biblical-map__lakes" />
      <path
        d={BIBLICAL_MAP_RIVERS}
        className="biblical-map__rivers"
        style={{ strokeWidth: 1.4 * unit }}
      />
    </>
  )
}
