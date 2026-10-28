import { isDarkTheme } from '~features/bible/BibleDOM/utils'
import themes, { themeNames } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import { getEntityPortraitGround } from './entityPortraits'

/** The ground behind a cut-out portrait in the current theme, as a `experimental_backgroundImage`. */
export const useEntityPortraitGround = () => {
  const theme = useTheme()
  const name = themeNames.find(item => themes[item].colors === theme.colors) ?? 'default'
  return getEntityPortraitGround(isDarkTheme(name), theme.colors)
}
