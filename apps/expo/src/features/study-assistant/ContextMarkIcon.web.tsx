import {
  BookOpenIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  SunriseIcon,
  UserRoundIcon,
} from 'lucide-react'
import ResourceIconDOM from '~common/icons/ResourceIconDOM'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import type { ReadingContext } from './conversations'
import { contextMark } from './contextDisplay'

const SYMBOLS = {
  book: BookOpenIcon,
  calendar: CalendarIcon,
  sunrise: SunriseIcon,
  user: UserRoundIcon,
  place: MapPinIcon,
  clock: ClockIcon,
}

/** The mark of a reading context: its resource's icon in its colour, or a plain symbol. */
export default function ContextMarkIcon({
  context,
  size = 13,
}: {
  context: ReadingContext
  size?: number
}) {
  const { colors } = useTheme()
  const mark = contextMark(context.kind)
  if ('resource' in mark)
    return (
      <ResourceIconDOM
        kind={mark.resource}
        size={size + 1}
        color={resolveUniverseColors(colors, mark.resource).foreground}
      />
    )
  const Mark = SYMBOLS[mark.symbol]
  return <Mark size={size} aria-hidden="true" />
}
