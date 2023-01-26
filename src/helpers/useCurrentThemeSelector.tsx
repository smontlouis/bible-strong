import { useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { shallowEqual, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'

const useCurrentThemeSelector = () => {
  const {
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
  } = useSelector(
    (state: RootState) => ({
      preferredColorScheme:
        state.user.bible.settings.preferredColorScheme || 'auto',
      preferredDarkTheme:
        state.user.bible.settings.preferredDarkTheme || 'dark',
      preferredLightTheme:
        state.user.bible.settings.preferredLightTheme || 'default',
    }),
    shallowEqual
  )

  const systemColorScheme = useColorScheme()

  const computedTheme = useMemo(() => {
    if (preferredColorScheme === 'auto') {
      if (systemColorScheme === 'dark') {
        return preferredDarkTheme
      }
      return preferredLightTheme
    }

    if (preferredColorScheme === 'dark') return preferredDarkTheme
    return preferredLightTheme
  }, [
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
    systemColorScheme,
  ])

  const memoizedResponse = useMemo(
    () => ({
      theme: computedTheme,
      colorScheme: (['default', 'sepia', 'nature', 'sunset'].includes(
        computedTheme
      )
        ? 'light'
        : 'dark') as 'light' | 'dark',
    }),
    [computedTheme]
  )

  return memoizedResponse
}

export default useCurrentThemeSelector
