import useDimensions from './useDimensions'

type MediaQuerySize = 'xs' | 'sm' | 'md' | 'lg'

const useMediaQueries = (): MediaQuerySize => {
  const {
    screen: { width },
  } = useDimensions()

  if (width <= 320) {
    return 'xs'
  }

  if (width < 768) {
    return 'sm'
  }

  if (width < 1024) {
    return 'md'
  }

  return 'lg'
}

/**
 * Receive { xs, sm, md, lg } or [xs, sm, md, lg]
 */
export const useMediaQueriesArray = (): (<T>(styles: T[] | Record<MediaQuerySize, T>) => T) => {
  const mediaQuery = useMediaQueries()
  const dimensionsArray: MediaQuerySize[] = ['xs', 'sm', 'md', 'lg']
  const mqPosition = dimensionsArray.findIndex(d => d === mediaQuery)
  return <T>(styles: T[] | Record<MediaQuerySize, T>): T =>
    Array.isArray(styles) ? styles[mqPosition] : styles[mediaQuery]
}

export default useMediaQueries
