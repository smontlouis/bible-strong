import useDimensions from './useDimensions'

const useMediaQueries = () => {
  const {
    screen: { width }
  } = useDimensions()

  if (width <= 400) {
    return 'xs'
  }

  if (width <= 768) {
    return 'sm'
  }

  if (width <= 1024) {
    return 'md'
  }

  return 'lg'
}

/**
 * Receive { xs, sm, md, lg } or [xs, sm, md, lg]
 */
export const useMediaQueriesArray = () => {
  const mediaQuery = useMediaQueries()
  const dimensionsArray = ['xs', 'sm', 'md', 'lg']
  const mqPosition = dimensionsArray.findIndex(d => d === mediaQuery)
  return styles =>
    Array.isArray(styles) ? styles[mqPosition] : styles[mediaQuery]
}

export default useMediaQueries
