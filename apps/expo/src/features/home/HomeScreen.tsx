import { goBackOrHome } from '~navigation/goBackOrHome'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useTheme } from '~themes/ThemeProvider'
import Color from 'color'
import React from 'react'
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
import HomeOpenSection, { NewTabLink } from './HomeOpenSection'
import HomeResumeSection from './HomeResumeSection'
import HomeSectionTitle from './HomeSectionTitle'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import HomeToday from './HomeToday'
import { HomeLayout } from './homeLayout'
import './homeStyles'
import ProfileStats from '~features/profile/components/ProfileStats'

// local react props
type HomeProps = {
  closeHome: () => void
  inWorkspace?: boolean
}

/**
 * One home for every size: the sections a phone stacks are the ones a wide window shows, in the
 * same order, each laying out its rows from the measured column width (see homeLayout.tsx).
 * Four groups with large titles: what today brings, what is mine (counters, then my work in
 * progress as small parts), what the app offers, and partners. Parts inside a group get small
 * titles so they read as belonging to it.
 */
export const Home = ({ closeHome, inWorkspace = false }: HomeProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const rightInset = useRightInsetToClear()

  return (
    <Box
      className="overflow-hidden border-continuous bg-canvas flex-[1]"
      // Clear a landscape iPhone's camera, as SafeAreaBox does for other pages.
      style={{ paddingRight: rightInset }}
    >
      <RightInsetCleared>
        <HomeScrollView showsVerticalScrollIndicator={false}>
          <HomeLayout>
            <HomeHeader />
            <Box className="pt-[16px]">
              <Events />
            </Box>
            <HomeSectionTitle title={t('home.today')} />
            <HomeToday />
            <HomeSectionTitle title={t('home.myLibrary')} />
            <ProfileStats home />
            <LoginPrompt className="mt-[12px]" />
            <HomeResumeSection />
            <HomeSectionTitle title={t('home.explore')} action={<NewTabLink />} />
            <HomeOpenSection />
            <Box className="h-[16px]" />
            <HomeExploreGrid />
            <HomeSubsectionTitle title={t('home.randomWord')} className="pt-[16px] pb-[4px]" />
            <HomeDiscovery />
            <HomeSectionTitle title={t('Aller plus loin')} />
            <HomeGoFurther />
            <HomeFooter />
          </HomeLayout>
        </HomeScrollView>
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
