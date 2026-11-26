import ReadingReminders from '~features/daily-reading/ReadingReminders'
import AssistantLauncher from '~features/study-assistant/AssistantLauncher'
import WorkspaceLayout from '~features/app-switcher/WorkspaceLayout'
import { SheetProvider } from '~common/sheet'
import { trackAnalyticsScreen } from '~helpers/analytics'
import * as Sentry from '@sentry/react-native'

import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { runAfterInteractions } from '~helpers/runAfterInteractions'
import { RootSiblingParent } from 'react-native-root-siblings'
import { useKeepAwake } from 'expo-keep-awake'
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
import BibleAudioPlayerSheet from '~features/bible-audio/ui/BibleAudioPlayerSheet'
import { FeatureOnboardingModal } from '~features/feature-onboarding'
import OnBoardingModal from '~features/onboarding/OnBoarding'
import StrobiTrialHandoff from '~features/onboarding/StrobiTrialHandoff'
import LocalMigrationGate from '~features/migrations/LocalMigrationGate'
import { appLogger } from '~helpers/agentObservability'
import { createFormSheetOptions } from '~navigation/formSheetOptions'
import { isPageOverSheet } from '~navigation/sheetPresentation'
import { Theme } from '~themes/index'
import { downloadManager } from '~helpers/downloadManager'
import { loadMobileResourceCatalog } from '~helpers/mobileResourceCatalog'
import { useAutomaticUpdates } from '~helpers/useAutomaticUpdates'
import { offlineResourceRegistry } from '~features/resources/resourceAvailability'
import DeferredVerseOfTheDayPrefetch from '~features/home/DeferredVerseOfTheDayPrefetch'
import AgentTools from '~devtools/AgentTools'

const PostMigrationStartup = ({ children }: { children: ReactNode }) => {
  const [resourcesReady, setResourcesReady] = useState(false)

  useEffect(() => {
    let active = true
    void loadMobileResourceCatalog().then(async catalog => {
      try {
        await downloadManager.restore()
      } catch (error) {
        appLogger.captureError('startup', 'resource_recovery.failed', error)
      }
      await offlineResourceRegistry.reconcileAll(catalog)
      if (active) setResourcesReady(true)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <>
      {children}
      <ReadingReminders />
      {resourcesReady && <DeferredVerseOfTheDayPrefetch />}
    </>
  )
}

const DeferredModals = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const handle = runAfterInteractions(() => setMounted(true))
    return () => handle.cancel()
  }, [])

  if (!mounted) return null

  return (
    <>
      <ChangelogModal />
      <OnBoardingModal />
      <StrobiTrialHandoff />
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
    }
    void trackAnalyticsScreen(segments)

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

const AutomaticUpdates = () => {
  useAutomaticUpdates()
  return null
}

const FullAppRuntime = ({ theme }: FullAppRuntimeProps) => {
  // On Android the activity can be gone when the root unmounts; releasing the lock then rejects.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true })

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
                    {__DEV__ && <AgentTools />}
                    <NavigationTracking />
                    <WorkspaceLayout>
                      <Stack
                        // A page opened over a sheet becomes a sheet (iOS cannot slip it under
                        // one): Strobi's settings from its conversation, the timeline from an
                        // event, a plan from an answer… From anywhere else, a page.
                        screenOptions={({ route, navigation }) => {
                          const { routes } = navigation.getState()
                          const index = routes.findIndex(
                            (candidate: { key: string }) => candidate.key === route.key
                          )
                          return isPageOverSheet(routes, index)
                            ? {
                                headerShown: false,
                                ...createFormSheetOptions(theme, {
                                  contentStyle: { bottom: 0 },
                                  sheetAllowedDetents: [1],
                                }),
                              }
                            : { headerShown: false }
                        }}
                      >
                        <Stack.Screen name="index" />
                        <Stack.Screen
                          name="(timeline-search)"
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            sheetAllowedDetents: [1],
                            sheetExpandsWhenScrolledToEdge: true,
                          })}
                        />
                        <Stack.Screen
                          name="(explore)"
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            // Full height only, as a trial of life without the half-height sheet (2026-11-08).
                            sheetAllowedDetents: [1],
                            sheetLargestUndimmedDetentIndex: 0,
                          })}
                        />
                        <Stack.Screen
                          name="(commentary)"
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            sheetAllowedDetents: [1],
                            sheetLargestUndimmedDetentIndex: 0,
                          })}
                        />
                        <Stack.Screen name="(library)" options={{ contentStyle: { bottom: 0 } }} />
                        <Stack.Screen
                          name="daily-story"
                          // The meditations as stories cover the whole screen, over the sidebar too.
                          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                        />
                        <Stack.Screen
                          name="study-assistant"
                          // A full-height form sheet on iOS; Android gets a page (createFormSheetOptions).
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            sheetAllowedDetents: [1],
                          })}
                        />
                        <Stack.Screen
                          name="premium"
                          // Like the assistant: a full-height form sheet on iOS, a page on Android.
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            sheetAllowedDetents: [1],
                          })}
                        />
                        <Stack.Screen
                          name="strong"
                          options={createFormSheetOptions(theme, {
                            contentStyle: { bottom: 0 },
                            sheetAllowedDetents: [1],
                            sheetExpandsWhenScrolledToEdge: true,
                          })}
                        />
                      </Stack>
                    </WorkspaceLayout>
                    <AssistantLauncher />
                    {/* Above the assistant's button, under the toasts. */}
                    <BibleAudioPlayerSheet />
                    <ThemedToaster />
                    <AutomaticUpdates />
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
