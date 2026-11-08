import ResourceIcon from '~common/icons/ResourceIcon'
import { FeatherIcon } from '~common/ui/Icon'
import type { ReadingContext } from './conversations'
import { contextMark } from './contextDisplay'

const SYMBOLS = {
  book: 'book-open',
  calendar: 'calendar',
  sunrise: 'sunrise',
  user: 'user',
  place: 'map-pin',
  clock: 'clock',
} as const

/** The mark of a reading context: its resource's icon in its colour, or a grey symbol. */
export default function ContextMarkIcon({
  context,
  size = 13,
}: {
  context: ReadingContext
  size?: number
}) {
  const mark = contextMark(context.kind)
  return 'resource' in mark ? (
    <ResourceIcon kind={mark.resource} size={size + 1} />
  ) : (
    <FeatherIcon name={SYMBOLS[mark.symbol]} size={size} color="grey" />
  )
}
