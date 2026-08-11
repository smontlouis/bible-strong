import { SheetProvider } from '~common/sheet'
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'

import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { InteractionManager } from 'react-native'
import { RootSiblingParent } from 'react-native-root-siblings'
import { useKeepAwake } from 'expo-keep-awake'
import TrackPlayer from 'react-native-track-player'
import { PortalProvider } from 'react-native-teleport'

import ChangelogModal from '~common/Changelog'
import ColorChangeModal from '~common/ColorChangeModal'
import ColorPickerModal from '~common/ColorPickerModal'
import InitHooks from '~common/InitHooks'
import ThemedToaster from '~common/ThemedToaster'
import UnifiedTagsModal from '~common/UnifiedTagsModal'
import { AppRatingModal } from '~features/app-rating'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { BookSelectorSheetProvider } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import { StrongAudioProvider } from '~features/bible/StrongAudioProvider'
import { FeatureOnboardingModal } from '~features/feature-onboarding'
import OnBoardingModal from '~features/onboarding/OnBoarding'
import LocalMigrationGate from '~features/migrations/LocalMigrationGate'
import { appLogger } from '~helpers/agentObservability'
import { createFormSheetOptions } from '~navigation/formSheetOptions'
import { Theme } from '~themes/index'
import { PlaybackService } from '../../../playbackService'
import { downloadManager } from '~helpers/downloadManager'
import { loadMobileResourceCatalog } from '~helpers/mobileResourceCatalog'

const PostMigrationStartup = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    void loadMobileResourceCatalog().then(() =>
      downloadManager.restore().catch(error => {
        appLogger.error('startup', 'resource_recovery.failed', { error })
      })
    )
  }, [])

  return children
}

const DeferredModals = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setMounted(true))
    return () => handle.cancel()
  }, [])

  if (!mounted) return null

  return (
    <>
      <ChangelogModal />
      <OnBoardingModal />
      <UnifiedTagsModal />
      <ColorPickerModal />
      <ColorChangeModal />
      <FeatureOnboardingModal />
      <AppRatingModal />
    </>
  )
}

const NavigationTracking = () => {
  const pathname = usePathname()
  const segments = useSegments()
  const params = useLocalSearchParams()
  const previousPathname = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousPathname.current === pathname) return

    const screenName = segments[segments.length - 1] || 'index'
    appLogger.info('navigation', 'screen.changed', {
      pathname,
      screenName,
      segments,
    })

    if (__DEV__) {
      console.log('[Navigation]', {
        pathname,
        segments,
        params: Object.keys(params).length > 0 ? params : undefined,
      })
    } else {
      logScreenView(getAnalytics(), {
        screen_class: screenName,
        screen_name: screenName,
      })
    }

    Sentry.addBreadcrumb({
      category: 'screen',
      message: `Navigated to: ${pathname}`,
      data: { pathname, segments },
    })

    previousPathname.current = pathname
  }, [pathname, segments, params])

  return null
}

type FullAppRuntimeProps = {
  theme: Theme
}

const FullAppRuntime = ({ theme }: FullAppRuntimeProps) => {
  useKeepAwake()

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      TrackPlayer.registerPlaybackService(() => PlaybackService)
    })
  }, [])

  return (
    <LocalMigrationGate>
      <PostMigrationStartup>
        <AppSwitcherProvider>
          <PortalProvider>
            <RootSiblingParent>
              <SheetProvider>
                <BookSelectorSheetProvider>
                  <StrongAudioProvider>
                    <InitHooks />
                    <NavigationTracking />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen
                        name="(explore)"
                        options={createFormSheetOptions(theme, {
                          contentStyle: { bottom: 0 },
                          sheetAllowedDetents: [0.45, 1],
                          sheetLargestUndimmedDetentIndex: 0,
                        })}
                      />
                      <Stack.Screen name="(library)" options={{ contentStyle: { bottom: 0 } }} />
                      <Stack.Screen
                        name="strong"
                        options={createFormSheetOptions(theme, {
                          contentStyle: { bottom: 0 },
                          sheetAllowedDetents: [1],
                          sheetExpandsWhenScrolledToEdge: true,
                        })}
                      />
                    </Stack>
                    <ThemedToaster />
                    <DeferredModals />
                  </StrongAudioProvider>
                </BookSelectorSheetProvider>
              </SheetProvider>
            </RootSiblingParent>
          </PortalProvider>
        </AppSwitcherProvider>
      </PostMigrationStartup>
    </LocalMigrationGate>
  )
}

export default FullAppRuntime
