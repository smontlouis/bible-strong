import AssistantLauncher from '~features/study-assistant/AssistantLauncher.web'
import StrobiTrialHandoff from '~features/onboarding/StrobiTrialHandoff'
import WorkspaceOnboarding from '~features/onboarding/workspace/WorkspaceOnboarding.web'
import { trackAnalyticsScreen } from '~helpers/analytics'
import WorkspaceAnalytics from '~features/app-switcher/WorkspaceAnalytics.web'
import ReferencePreviewHost from '~features/bibleReferencePreview/ReferencePreviewHost'
import ConfirmDialogHost from '~common/ConfirmDialog/ConfirmDialogHost.web'
import PrintPreparation from '~features/print/PrintPreparation.web'
import { useWorkspaceRoutePanel } from '~navigation/useWorkspaceRoutePanel'
import WorkspaceLayout from '~features/app-switcher/WorkspaceLayout'
import IncomingLinkTab from '~features/app-switcher/IncomingLinkTab'
import * as Sentry from '@sentry/react-native'
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useLocalSearchParams,
  usePathname,
  useSegments,
} from 'expo-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { RootSiblingParent } from 'react-native-root-siblings'

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
import BibleAudioPlayerSheet from '~features/bible-audio/ui/BibleAudioPlayerSheet'
import { appLogger } from '~helpers/agentObservability'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { createFormSheetOptions } from '~navigation/formSheetOptions'
import { isDarkThemeName } from '~themes/darkThemes'
import type { Theme } from '~themes/index'

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

/**
 * Every screen of the stack stands on the navigation theme's ground, which shows until the screen
 * draws: the app's own, not the light grey React Navigation picks when it is given none.
 */
const useNavigationTheme = (theme: Theme) => {
  const { theme: themeName } = useCurrentThemeSelector()
  const dark = isDarkThemeName(themeName)
  const base = dark ? DarkTheme : DefaultTheme
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.reverse,
      card: theme.colors.reverse,
      text: theme.colors.default,
      border: theme.colors.border,
    },
  }
}

/** `children` mount inside the workspace providers: the desktop app adds its shell there. */
const FullAppRuntime = ({ theme, children }: { theme: Theme; children?: ReactNode }) => {
  const panel = useWorkspaceRoutePanel()
  const navigationTheme = useNavigationTheme(theme)
  return (
    <AppSwitcherProvider>
      <RootSiblingParent>
        <SheetProvider>
          <BookSelectorSheetProvider>
            <StrongAudioProvider>
              <InitHooks />
              {children}
              <NavigationTracking />
              <WorkspaceLayout>
                <NavigationThemeProvider value={navigationTheme}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: {
                        marginRight: panel.open ? panel.reservedWidth : 0,
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
                      options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
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
                </NavigationThemeProvider>
              </WorkspaceLayout>
              <IncomingLinkTab />
              <WorkspaceAnalytics />
              <AssistantLauncher />
              {/* Above the assistant's button, under the toasts. */}
              <BibleAudioPlayerSheet />
              <ConfirmDialogHost />
              <PrintPreparation />
              <ThemedToaster />
              <ChangelogModal />
              <UnifiedTagsModal />
              <ReferencePreviewHost />
              <ColorPickerModal />
              <ColorChangeModal />
              <WorkspaceOnboarding />
              <StrobiTrialHandoff />
            </StrongAudioProvider>
          </BookSelectorSheetProvider>
        </SheetProvider>
      </RootSiblingParent>
    </AppSwitcherProvider>
  )
}

export default FullAppRuntime
