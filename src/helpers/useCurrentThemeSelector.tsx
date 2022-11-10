import { useColorScheme } from 'react-native'
import { useSelector } from 'react-redux'
import { PreferredLightTheme } from '~common/types'
import { RootState } from '~redux/modules/reducer'

const useCurrentThemeSelector = () => {
  const {
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
  } = useSelector((state: RootState) => ({
    preferredColorScheme: state.user.bible.settings.preferredColorScheme,
    preferredDarkTheme: state.user.bible.settings.preferredDarkTheme,
    preferredLightTheme: state.user.bible.settings.preferredLightTheme,
  }))

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
    colorScheme: (['default', 'sepia', 'nature', 'sunset'].includes(
      computedTheme
    )
      ? 'light'
      : 'dark') as 'light' | 'dark',
  }
}

export default useCurrentThemeSelector
