import { ThemeProvider } from '@emotion/react'
import { useEffect, useState } from 'react'
import { SystemBars } from 'react-native-edge-to-edge'
import { ThemeSelectionOverrideContext } from '~common/ThemeSelectionOverrideContext'
import type { CurrentTheme } from '~common/types'
import Box from '~common/ui/Box'
import AbelOnboarding from '~features/onboarding/AbelOnboarding'
import SelectResources from '~features/onboarding/SelectResources'
import themes from '~themes'
import PlaygroundHome from './PlaygroundHome'

type PlaygroundView = 'home' | 'abel-onboarding' | 'offline-setup'

const PlaygroundScreen = () => {
  const [view, setView] = useState<PlaygroundView>('home')
  const [selectedTheme, setSelectedTheme] = useState<CurrentTheme>('default')
  const colorScheme = ['dark', 'black', 'mauve', 'night'].includes(selectedTheme) ? 'dark' : 'light'

  useEffect(() => {
    const entry = SystemBars.pushStackEntry({ style: colorScheme === 'dark' ? 'light' : 'dark' })
    return () => SystemBars.popStackEntry(entry)
  }, [colorScheme])

  const renderView = () => {
    if (view === 'abel-onboarding') {
      return <AbelOnboarding completionMode="confirmation" onComplete={() => setView('home')} />
    }

    if (view === 'offline-setup') {
      return <SelectResources mode="preview" onClose={() => setView('home')} />
    }

    return (
      <PlaygroundHome
        selectedTheme={selectedTheme}
        onSelectTheme={setSelectedTheme}
        onOpenAbelOnboarding={() => setView('abel-onboarding')}
        onOpenOfflineSetup={() => setView('offline-setup')}
      />
    )
  }

  return (
    <ThemeSelectionOverrideContext.Provider value={{ colorScheme, theme: selectedTheme }}>
      <ThemeProvider theme={themes[selectedTheme]}>
        <Box flex>{renderView()}</Box>
      </ThemeProvider>
    </ThemeSelectionOverrideContext.Provider>
  )
}

export default PlaygroundScreen
