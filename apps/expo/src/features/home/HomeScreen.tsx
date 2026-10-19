import { goBackOrHome } from '~navigation/goBackOrHome'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { useTheme } from '~themes/ThemeProvider'
import Color from 'color'
import { getAppleReviewing } from '~helpers/getAppleReviewing'
import React from 'react'
import { Linking, Platform } from 'react-native'
import DesktopHome from './DesktopHome'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { HomeScrollView } from '~common/ui/ScrollView'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import PlanHome from './PlanHome'
import UserWidget, { LoginPrompt } from './UserWidget'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Events } from './Events'
import HomeDiscovery from './HomeDiscovery'
import HomeExploreGrid from './HomeExploreGrid'
import HomeHeader from './HomeHeader'
import HomeOpenSection from './HomeOpenSection'
import HomeRowCard from './HomeRowCard'
import * as Icon from '~common/ui/classNameIcons'
import { Image } from 'expo-image'
import useLanguage from '~helpers/useLanguage'
import HomeSectionTitle from './HomeSectionTitle'
import ProfileStats from '~features/profile/components/ProfileStats'
import HistoryHomeSection from '~features/history/HistoryHomeSection'
// local react props
type HomeProps = {
  closeHome: () => void
  inWorkspace?: boolean
}

export const Home = ({ closeHome, inWorkspace = false }: HomeProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const isWide = useResponsiveWorkspace()
  const appleIsReviewing = getAppleReviewing()
  const lang = useLanguage()

  if (Platform.OS === 'web' && isWide) return <DesktopHome />

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey flex-[1]">
      <HomeScrollView showsVerticalScrollIndicator={false}>
        <HomeHeader />
        <Box className="pt-[16px]">
          <Events />
        </Box>
        <HomeSectionTitle title={t('home.today')} />
        <UserWidget />
        <HomeSectionTitle title={t('home.myLibrary')} />
        <ProfileStats home />
        <LoginPrompt className="mt-[12px]" />
        <HomeSectionTitle
          title={t('home.resume')}
          action={
            <Link route="History" className="py-[12px]">
              <Text className="text-primary text-[13px] font-bold">{t('history.title')}</Text>
            </Link>
          }
        />
        <HistoryHomeSection headerless />
        <PlanHome title={t('home.myPlans')} />
        <HomeOpenSection />
        <HomeSectionTitle title={t('home.explore')} />
        <HomeExploreGrid />
        <Text className="px-[20px] pt-[24px] pb-[10px] text-[16px] font-bold">
          {t('home.randomWord')}
        </Text>
        <HomeDiscovery />
        <HomeSectionTitle title={t('Aller plus loin')} />
        <Box className="px-[20px] pb-[32px] gap-[10px]">
          <HomeRowCard
            dark
            href="https://click.audibible.app/5nmN/stephane30"
            title={t('audibible.try')}
            description={t('audibible.description')}
            iconBackground="#FFFFFF"
            icon={
              <Image
                source={require('~assets/images/audibible-icon.png')}
                accessible={false}
                style={{ width: 44, height: 44 }}
              />
            }
          />
          {!appleIsReviewing && (
            <HomeRowCard
              href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}
              title={t('donation.title')}
              description={t('donation.description')}
              iconBackground="rgba(255,118,117,0.14)"
              icon={<Icon.Feather name="heart" size={22} color="#E05554" />}
            />
          )}
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey">
          <Box
            className="overflow-hidden border-continuous bg-reverse flex-row px-[20px] pt-[20px]"
            style={[
              { paddingBottom: insets.bottom + 100 },
              { borderTopLeftRadius: 30, borderTopRightRadius: 30 },
            ]}
          >
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Button
                color="#3b5998"
                onPress={() => Linking.openURL('https://www.facebook.com/fr.bible.strong')}
                leftIcon={
                  <FeatherIcon
                    name="facebook"
                    size={20}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                }
              >
                {t('Suivre')}
              </Button>
            </Box>
            <Box className="overflow-hidden border-continuous w-[20px]" />
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Button
                color="#2ecc71"
                route="FAQ"
                leftIcon={
                  <FeatherIcon
                    name="help-circle"
                    size={20}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                }
              >
                {t('FAQ')}
              </Button>
            </Box>
          </Box>
        </Box>
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
                `${Color(theme.colors.lightGrey).alpha(0).string()}`,
                `${theme.colors.lightGrey}`,
              ]}
            />
          </Box>
          <TouchableBox
            className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[50px] rounded-[30px] bg-reverse"
            accessibilityLabel={t('Fermer')}
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={closeHome}
            style={{
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            }}
          >
            <FeatherIcon name="x" size={24} color="grey" />
          </TouchableBox>
        </Box>
      )}
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
