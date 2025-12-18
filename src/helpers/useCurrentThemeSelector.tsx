import { useColorScheme } from 'react-native'
import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'

const useCurrentThemeSelector = () => {
  const preferredColorScheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredColorScheme || 'auto'
  )
  const preferredLightTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredLightTheme || 'default'
  )
  const preferredDarkTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredDarkTheme || 'dark'
  )

  const systemColorScheme = useColorScheme()

  const computedTheme = (() => {
    if (preferredColorScheme === 'auto') {
      if (systemColorScheme === 'dark') {
        return preferredDarkTheme
      }
      return preferredLightTheme
    }

    if (preferredColorScheme === 'dark') return preferredDarkTheme
    return preferredLightTheme
  })()

  return {
    theme: computedTheme,
    colorScheme: (['default', 'sepia', 'nature', 'sunset'].includes(computedTheme)
      ? 'light'
      : 'dark') as 'light' | 'dark',
  }
}

export default useCurrentThemeSelector
