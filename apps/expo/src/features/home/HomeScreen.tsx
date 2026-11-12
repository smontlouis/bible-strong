import { goBackOrHome } from '~navigation/goBackOrHome'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useTheme } from '~themes/ThemeProvider'
import {
  useWorkspaceHeaderInset,
  WORKSPACE_SIDEBAR_BUTTON_HEIGHT,
} from '~features/app-switcher/workspaceHeaderInset'
import Color from 'color'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { Platform, type View, type ViewStyle } from 'react-native'
import Box, { RightInsetCleared, TouchableBox, useRightInsetToClear } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HomeScrollView } from '~common/ui/ScrollView'
import { floatingShadow } from '~common/ui/surfaces'
import { LoginPrompt } from './UserWidget'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Events } from './Events'
import HomeDiscovery from './HomeDiscovery'
import HomeExploreGrid from './HomeExploreGrid'
import HomeFooter from './HomeFooter'
import HomeGoFurther from './HomeGoFurther'
import HomeHeader from './HomeHeader'
import HomeResumeSection from './HomeResumeSection'
import HomeSectionTitle from './HomeSectionTitle'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import HomeToday from './HomeToday'
import SessionExpiredNotice from './SessionExpiredNotice'
import { HOME_MAX_WIDTH, HomeLayout } from './homeLayout'
import './homeStyles'
import ProfileStats from '~features/profile/components/ProfileStats'

/** Width of the column that stays in place beside the scrolling one on a large Web window. */
const HOME_SIDE_WIDTH = 440
/** Room the side column keeps under its last card. */
const HOME_SIDE_BOTTOM = 32
/**
 * What the header's top clearance exceeds the room above the first rows of « Reprendre » by:
 * lowering the scrolling column by the difference sets those rows level with the search.
 */
const HOME_FLOW_LEAD = 22

// local react props
type HomeProps = {
  closeHome: () => void
  inWorkspace?: boolean
}

/**
 * One home for every size: the sections a phone stacks are the ones a wide window shows, in the
 * same order, each laying out its rows from the measured column width (see homeLayout.tsx).
 * A Web window with room for two columns sets the reader's own part (greeting, the day, the
 * library) on the left, where it stays in place, and scrolls the rest on the right.
 * Under the header and the day, which needs no title, four groups with large titles: my work in
 * progress, my library, what the app offers, and partners. Parts inside a group get small titles
 * so they read as belonging to it.
 */
export const Home = ({ closeHome, inWorkspace = false }: HomeProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const rightInset = useRightInsetToClear()
  const rootRef = useRef<View>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [sideHeight, setSideHeight] = useState(0)
  const measure = (width: number, height: number) =>
    setFrame(current =>
      current.width === width && current.height === height ? current : { width, height }
    )
  // On Web the DOM can be read before the first paint, so the home never flashes as one column.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const node = rootRef.current as unknown as HTMLElement | null
    const rect = node?.getBoundingClientRect?.()
    if (rect) measure(Math.round(rect.width), Math.round(rect.height))
  }, [])
  const split =
    Platform.OS === 'web' && inWorkspace && frame.width >= HOME_SIDE_WIDTH + HOME_MAX_WIDTH
  // A side column taller than the window scrolls with the page, or its end could not be reached.
  // Same clearance as HomeHeader: its greeting starts below the sidebar button.
  const headerClearance = useWorkspaceHeaderInset() ? WORKSPACE_SIDEBAR_BUTTON_HEIGHT : 20
  const sideStays = sideHeight > 0 && sideHeight <= frame.height

  const side = (
    <>
      <HomeHeader />
      <SessionExpiredNotice className="mt-[16px]" />
      <Box className="pt-[16px]">
        <Events />
      </Box>
      {/* The day needs no title: the date of the header already says it. */}
      <Box className="h-[12px]" />
      <HomeToday />
      <HomeSectionTitle title={t('home.myLibrary')} />
      <ProfileStats home />
      <LoginPrompt className="mt-[12px]" />
    </>
  )
  const flow = (
    <>
      <HomeResumeSection />
      <HomeSectionTitle title={t('home.explore')} />
      <HomeExploreGrid />
      <HomeSubsectionTitle title={t('home.randomWord')} className="pt-[16px] pb-[4px]" />
      <HomeDiscovery />
      <HomeSectionTitle title={t('Aller plus loin')} />
      <HomeGoFurther />
      <HomeFooter />
    </>
  )

  return (
    <Box
      ref={rootRef}
      onLayout={({ nativeEvent }) =>
        measure(Math.round(nativeEvent.layout.width), Math.round(nativeEvent.layout.height))
      }
      className="overflow-hidden border-continuous bg-canvas flex-[1]"
      // Clear a landscape iPhone's camera, as SafeAreaBox does for other pages.
      style={{ paddingRight: rightInset }}
    >
      <RightInsetCleared>
        {split ? (
          <HomeScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              maxWidth: HOME_SIDE_WIDTH + HOME_MAX_WIDTH,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Box
              onLayout={({ nativeEvent }) => setSideHeight(Math.round(nativeEvent.layout.height))}
              style={[
                { width: HOME_SIDE_WIDTH, paddingBottom: HOME_SIDE_BOTTOM },
                sideStays && ({ position: 'sticky', top: 0 } as unknown as ViewStyle),
              ]}
            >
              <HomeLayout>{side}</HomeLayout>
            </Box>
            <Box
              className="flex-1 min-w-0"
              style={{ marginTop: Math.max(0, headerClearance - HOME_FLOW_LEAD) }}
            >
              <HomeLayout>{flow}</HomeLayout>
            </Box>
          </HomeScrollView>
        ) : (
          <HomeScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ maxWidth: HOME_MAX_WIDTH }}
          >
            <HomeLayout>
              {side}
              {flow}
            </HomeLayout>
          </HomeScrollView>
        )}
        {!inWorkspace && (
          <Box
            className="overflow-hidden border-continuous absolute left-[0px] right-[0px] bottom-[0px] h-[100px] items-center justify-center"
            style={{ paddingBottom: insets.bottom }}
          >
            <Box className="overflow-hidden border-continuous absolute top-[0px] bottom-[0px] left-[0px] right-[0px]">
              <LinearGradient
                start={[0.5, 0]}
                end={[0.5, 0.9]}
                style={{ height: 100 }}
                colors={[
                  `${Color(theme.colors.canvas).alpha(0).string()}`,
                  `${theme.colors.canvas}`,
                ]}
              />
            </Box>
            <TouchableBox
              className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[50px] rounded-full bg-surface-raised"
              accessibilityLabel={t('Fermer')}
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={closeHome}
              // The close button floats above the page, so it is the one home element with a shadow.
              style={{ ...floatingShadow, overflow: 'visible' }}
            >
              <FeatherIcon name="x" size={24} color="grey" />
            </TouchableBox>
          </Box>
        )}
      </RightInsetCleared>
    </Box>
  )
}

const HomeScreen = () => {
  const router = useRouter()
  const closeHome = () => goBackOrHome(router)

  const isWide = useResponsiveWorkspace()
  return <Home closeHome={closeHome} inWorkspace={isWide} />
}
export default HomeScreen
