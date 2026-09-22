import AssistantLauncher from '~features/study-assistant/AssistantLauncher.web'
import { trackAnalyticsScreen } from '~helpers/analytics'
import WorkspaceAnalytics from '~features/app-switcher/WorkspaceAnalytics.web'
import ReferencePreviewHost from '~features/bibleReferencePreview/ReferencePreviewHost'
import ConfirmDialogHost from '~common/ConfirmDialog/ConfirmDialogHost.web'
import { useWorkspaceRoutePanel } from '~navigation/useWorkspaceRoutePanel'
import WorkspaceLayout from '~features/app-switcher/WorkspaceLayout'
import * as Sentry from '@sentry/react-native'
import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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
import { useWebAuthStatus } from './useWebAuthStatus'
import { isPublicContentPath } from '~navigation/publicContentRoutes'
import { PublicShellProvider } from '~navigation/PublicShellContext'
import { resolvePublicShellMode } from './publicShellPolicy'

const NavigationTracking = () => {
  const pathname = usePathname()
  const segments = useSegments()
  const params = useLocalSearchParams()
  const previousPathname = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    const screenName = segments[segments.length - 1] || 'index'
    appLogger.info('navigation', 'screen.changed', { pathname, screenName, segments })
    void trackAnalyticsScreen(segments)
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
  const panel = useWorkspaceRoutePanel()
  const pathname = usePathname()
  const authStatus = useWebAuthStatus()
  const [guestWorkspaceRequested, setGuestWorkspaceRequested] = useState(false)
  const publicPath = isPublicContentPath(pathname)
  const publicShellMode = resolvePublicShellMode({
    publicPath,
    authStatus,
    guestWorkspaceRequested,
  })
  const authPending = publicShellMode === 'pending'
  const publicShellActive = publicShellMode === 'public'
  useEffect(() => {
    void TrackPlayer.registerPlaybackService(() => PlaybackService)
  }, [])

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          marginRight: !publicShellActive && panel.open ? panel.reservedWidth : 0,
          ...{
            transitionProperty: 'margin-right',
            transitionDuration: '240ms',
            transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
          },
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="(timeline-search)"
        options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
      />
      <Stack.Screen
        name="(explore)"
        options={createFormSheetOptions(theme, { sheetAllowedDetents: [0.45, 1] })}
      />
      <Stack.Screen
        name="(commentary)"
        options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
      />
      <Stack.Screen name="(library)" />
      <Stack.Screen
        name="strong"
        options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
      />
    </Stack>
  )

  return (
    <AppSwitcherProvider>
      <RootSiblingParent>
        <SheetProvider>
          <BookSelectorSheetProvider>
            <StrongAudioProvider>
              <InitHooks />
              <NavigationTracking />
              <PublicShellProvider
                active={publicShellActive}
                openWorkspace={() => setGuestWorkspaceRequested(true)}
              >
                <WorkspaceLayout mode={publicShellMode}>{stack}</WorkspaceLayout>
              </PublicShellProvider>
              {!publicShellActive && !authPending && <WorkspaceAnalytics />}
              {!publicShellActive && !authPending && <AssistantLauncher />}
              {!publicShellActive && !authPending && <ConfirmDialogHost />}
              <ThemedToaster />
              {!publicShellActive && !authPending && <ChangelogModal />}
              {!publicShellActive && !authPending && <UnifiedTagsModal />}
              <ReferencePreviewHost />
              {!publicShellActive && !authPending && <ColorPickerModal />}
              {!publicShellActive && !authPending && <ColorChangeModal />}
            </StrongAudioProvider>
          </BookSelectorSheetProvider>
        </SheetProvider>
      </RootSiblingParent>
    </AppSwitcherProvider>
  )
}

export default FullAppRuntime
