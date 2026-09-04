/**
 * Determines if the current theme is a dark theme
 * Used for calculating contrast colors for highlights
 */
export const isDarkTheme = (theme: string): boolean => {
  return theme === 'dark' || theme === 'black' || theme === 'night' || theme === 'mauve'
}

/**
 * Shared CSS properties to prevent text selection in WebView DOM components.
 * Spread into goober styled component style objects.
 */
export const noSelect = {
  userSelect: 'none' as const,
  WebkitUserSelect: 'none' as const,
  WebkitTouchCallout: 'none' as const,
}
