import { ThemeProvider } from '@emotion/react'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useKeepAwake } from 'expo-keep-awake'
import { memo, useEffect, useMemo } from 'react'
import { ActivityIndicator, StatusBar, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MenuProvider } from 'react-native-popup-menu'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { Persistor } from 'redux-persist'
import { PersistGate } from 'redux-persist/integration/react'
import ErrorBoundary from '~common/ErrorBoundary'
import InitHooks from '~common/InitHooks'
import { CurrentTheme } from '~common/types'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { DBStateProvider } from '~helpers/databaseState'
import { QueryClient, QueryClientProvider } from '~helpers/react-query-lite'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useUpdates } from '~helpers/useUpdates'
import AppNavigator from '~navigation/AppNavigator'
import { RootState } from '~redux/modules/reducer'
import getTheme, { Theme, baseTheme } from '~themes/index'

interface Props {
  persistor: Persistor
}

const changeStatusBarStyle = (currentTheme: CurrentTheme) => {
  if (['mauve', 'dark', 'night', 'black'].includes(currentTheme))
    StatusBar.setBarStyle('light-content')
  else StatusBar.setBarStyle('dark-content')
}

const queryClient = new QueryClient()

const InitApp = ({ persistor }: Props) => {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: currentTheme } = useCurrentThemeSelector()
  useKeepAwake()
  useUpdates()

  useEffect(() => {
    changeStatusBarStyle(currentTheme)
  }, [currentTheme])

  const theme = useMemo(() => {
    const defaultTheme: Theme = getTheme[currentTheme] || baseTheme

    return {
      ...defaultTheme,
      fontFamily: {
        ...defaultTheme.fontFamily,
        paragraph: fontFamily,
      },
    }
  }, [currentTheme, fontFamily])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SafeAreaProvider>
          <ThemeProvider theme={theme}>
            <MenuProvider
              backHandler
              customStyles={{
                backdrop: {
                  backgroundColor: 'black',
                  opacity: 0.2,
                },
              }}
            >
              <QueryClientProvider client={queryClient}>
                <PersistGate
                  loading={
                    <View
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator />
                    </View>
                  }
                  persistor={persistor}
                >
                  <DBStateProvider>
                    <ErrorBoundary>
                      <AppSwitcherProvider>
                        <InitHooks />
                        <AppNavigator />
                      </AppSwitcherProvider>
                    </ErrorBoundary>
                  </DBStateProvider>
                </PersistGate>
              </QueryClientProvider>
            </MenuProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}

export default memo(InitApp)
