// A place itself, out of focus, behind the characters who speak there: the map's preview
// framed on the station, as the camera shows it. No image of its own to load.
import type { Station } from './valence-story'
import { stationAnchors, VALENCE_HEIGHT, VALENCE_WIDTH } from './valence-world'

/** How much of the town shows across the backdrop, in map units. */
const PLACE_SPAN = 300

export function PlaceBackdrop({ station, className }: { station: Station; className: string }) {
  const anchor = stationAnchors[station.id]
  return (
    <div className={className} aria-hidden="true">
      <img
        src="./valence-1876/map/preview.webp"
        alt=""
        draggable={false}
        style={{
          width: `${(VALENCE_WIDTH / PLACE_SPAN) * 100}%`,
          aspectRatio: `${VALENCE_WIDTH} / ${VALENCE_HEIGHT}`,
          left: `${50 - (anchor.x / PLACE_SPAN) * 100}%`,
          // Percent margins follow the width, like the image's own size.
          marginTop: `${-(anchor.y / PLACE_SPAN) * 100}%`,
        }}
      />
    </div>
  )
}
