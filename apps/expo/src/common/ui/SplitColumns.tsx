import { useEffect, useState, type ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import Box from './Box'
import { SPLIT_COLUMNS_GAP, WIDE_PAGE_HEADER_HEIGHT } from './widePage'

/** How long a column may stay empty before the other takes the page: its content may be loading. */
const EMPTY_COLUMN_DELAY = 700

type ColumnProps = {
  children: ReactNode
  /** A fixed width; without it the column takes the room left, up to `maxWidth`. */
  width?: number
  maxWidth?: number
  /** Height the page leaves under its header. */
  viewport: number
  top: number
}

/**
 * One column of a wide page. It stays in place while the other scrolls when it fits in the
 * window; taller, it scrolls with the page, or its end could not be reached. A fixed column with
 * nothing to show gives its room back.
 */
const Column = ({ children, width, maxWidth, viewport, top }: ColumnProps) => {
  const [height, setHeight] = useState<number>()
  const [collapsed, setCollapsed] = useState(false)
  const empty = height === 0
  useEffect(() => {
    if (!empty) return setCollapsed(false)
    const timer = setTimeout(() => setCollapsed(true), EMPTY_COLUMN_DELAY)
    return () => clearTimeout(timer)
  }, [empty])
  const stays = !!height && height + top <= viewport
  return (
    <Box
      style={[
        width === undefined
          ? { flex: 1, minWidth: 0, maxWidth }
          : { width: collapsed ? 0 : width, overflow: collapsed ? 'hidden' : 'visible' },
        collapsed && { marginHorizontal: -SPLIT_COLUMNS_GAP / 2 },
        stays && ({ position: 'sticky', top } as unknown as ViewStyle),
      ]}
    >
      <Box
        style={width === undefined ? undefined : { width }}
        onLayout={({ nativeEvent }) => setHeight(Math.round(nativeEvent.layout.height))}
      >
        {children}
      </Box>
    </Box>
  )
}

/**
 * The two columns of a wide page, set straight into the page's scroll view (design-system
 * README, « The app »). Nothing between them and the scroll view may clip its overflow, or the
 * column that stays in place would scroll away. Use only when `useWidePage` says the page is
 * wide.
 */
const SplitColumns = ({
  start,
  end,
  startWidth,
  endWidth,
  startMaxWidth,
  endMaxWidth,
  height,
  top = 0,
}: {
  start: ReactNode
  end: ReactNode
  startWidth?: number
  endWidth?: number
  startMaxWidth?: number
  endMaxWidth?: number
  /** Height of the page, header included, as `useWidePage` measures it. */
  height: number
  /** Where a column that stays in place rests under the top of the scroll view. */
  top?: number
}) => {
  const viewport = height - WIDE_PAGE_HEADER_HEIGHT
  return (
    <Box className="w-full flex-row items-start justify-center" style={{ gap: SPLIT_COLUMNS_GAP }}>
      <Column width={startWidth} maxWidth={startMaxWidth} viewport={viewport} top={top}>
        {start}
      </Column>
      <Column width={endWidth} maxWidth={endMaxWidth} viewport={viewport} top={top}>
        {end}
      </Column>
    </Box>
  )
}

export default SplitColumns
