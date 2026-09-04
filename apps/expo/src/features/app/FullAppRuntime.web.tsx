import * as Sentry from '@sentry/react-native'
import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'
import { RootSiblingParent } from 'react-native-root-siblings'
import TrackPlayer from 'react-native-track-player'

import ChangelogModal from '~common/Changelog'
import ColorChangeModal from '~common/ColorChangeModal'
import ColorPickerModal from '~common/ColorPickerModal'
import InitHooks from '~common/InitHooks'
import { SheetProvider } from '~common/sheet'
import ThemedToaster from '~common/ThemedToaster'
import UnifiedTagsModal from '~common/UnifiedTagsModal'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { BookSelectorSheetProvider } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import { StrongAudioProvider } from '~features/bible/StrongAudioProvider'
import { appLogger } from '~helpers/agentObservability'
import { createFormSheetOptions } from '~navigation/formSheetOptions'
import type { Theme } from '~themes/index'
import { PlaybackService } from '../../../playbackService'

const NavigationTracking = () => {
  const pathname = usePathname()
  const segments = useSegments()
  const params = useLocalSearchParams()
  const previousPathname = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    const screenName = segments[segments.length - 1] || 'index'
    appLogger.info('navigation', 'screen.changed', { pathname, screenName, segments })
    Sentry.addBreadcrumb({
      category: 'screen',
      message: `Navigated to: ${pathname}`,
      data: { pathname, segments, params: Object.keys(params).length ? params : undefined },
    })
    previousPathname.current = pathname
  }, [params, pathname, segments])

  return null
}

const FullAppRuntime = ({ theme }: { theme: Theme }) => {
  useEffect(() => {
    void TrackPlayer.registerPlaybackService(() => PlaybackService)
  }, [])

  return (
    <AppSwitcherProvider>
      <RootSiblingParent>
        <SheetProvider>
          <BookSelectorSheetProvider>
            <StrongAudioProvider>
              <InitHooks />
              <NavigationTracking />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="(timeline-search)"
                  options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
                />
                <Stack.Screen
                  name="(explore)"
                  options={createFormSheetOptions(theme, { sheetAllowedDetents: [0.45, 1] })}
                />
                <Stack.Screen name="(library)" />
                <Stack.Screen
                  name="strong"
                  options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
                />
              </Stack>
              <ThemedToaster />
              <ChangelogModal />
              <UnifiedTagsModal />
              <ColorPickerModal />
              <ColorChangeModal />
            </StrongAudioProvider>
          </BookSelectorSheetProvider>
        </SheetProvider>
      </RootSiblingParent>
    </AppSwitcherProvider>
  )
}

export default FullAppRuntime
