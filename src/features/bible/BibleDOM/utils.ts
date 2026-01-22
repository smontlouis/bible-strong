/**
 * Determines if the current theme is a dark theme
 * Used for calculating contrast colors for highlights
 */
export const isDarkTheme = (theme: string): boolean => {
  return theme === 'dark' || theme === 'black' || theme === 'night' || theme === 'mauve'
}
