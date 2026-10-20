import {
  Children,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  Platform,
  useWindowDimensions,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native'
import Box from '~common/ui/Box'
import { PAGE_CONTENT_MAX_WIDTH } from '~common/ui/PageContent'

/**
 * Widest home column, gutters included: the general page width, which HomeScrollView applies.
 * Narrower allocations use their whole width.
 */
const HOME_MAX_WIDTH = PAGE_CONTENT_MAX_WIDTH
/** Side gutter shared by every home section. */
export const HOME_GUTTER = 20
/** Content width from which the rows that scroll on a phone lay out flat or as grids. */
const HOME_WIDE_CONTENT = 620

const HomeWidthContext = createContext<number | undefined>(undefined)

/**
 * Measures the home column so each section picks its columns from the space it actually gets
 * (sidebar and panels on Web, split view on iPad) rather than from the window.
 */
export const HomeLayout = ({ children }: PropsWithChildren) => {
  const window = useWindowDimensions()
  const ref = useRef<View>(null)
  const [width, setWidth] = useState(() => Math.min(window.width, HOME_MAX_WIDTH))
  const update = (next: number) => {
    const rounded = Math.round(next)
    if (rounded > 0) setWidth(current => (current === rounded ? current : rounded))
  }
  // On Web the DOM can be read before the first paint, so grids never flash at the wrong count.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const node = ref.current as unknown as HTMLElement | null
    if (node?.getBoundingClientRect) update(node.getBoundingClientRect().width)
  }, [])
  return (
    <Box ref={ref} onLayout={({ nativeEvent }) => update(nativeEvent.layout.width)}>
      <HomeWidthContext.Provider value={width}>{children}</HomeWidthContext.Provider>
    </Box>
  )
}

/** Width between the two gutters, and whether phone rows should lay out flat. */
export const useHomeLayout = () => {
  const window = useWindowDimensions()
  const width = useContext(HomeWidthContext) ?? Math.min(window.width, HOME_MAX_WIDTH)
  const content = width - 2 * HOME_GUTTER
  return { content, wide: content >= HOME_WIDE_CONTENT }
}

/**
 * Equal cells laid out inside the gutters. Cells keep their position in a single parent, so a
 * column change re-wraps them without remounting their content.
 */
export const HomeGrid = ({
  columns,
  columnGap = 12,
  rowGap = columnGap,
  style,
  children,
}: PropsWithChildren<{
  columns: number
  columnGap?: number
  rowGap?: number
  style?: StyleProp<ViewStyle>
}>) => {
  const { content } = useHomeLayout()
  const cell = Math.floor((content - columnGap * (columns - 1)) / columns)
  return (
    <Box
      className="flex-row flex-wrap"
      style={[{ columnGap, rowGap, paddingHorizontal: HOME_GUTTER }, style]}
    >
      {Children.map(children, child => (child ? <Box style={{ width: cell }}>{child}</Box> : null))}
    </Box>
  )
}
