import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import Color from 'color'
import { getRemoteConfig, getValue } from '@react-native-firebase/remote-config'
import React from 'react'
import { Linking, Platform, ScrollView as RNScrollView } from 'react-native'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { HomeScrollView } from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import DonationWidget from './DonationWidget'
import NaveOfTheDay from './NaveOfTheDay'
import PlanHome from './PlanHome'
import StrongOfTheDay from './StrongOfTheDay'
import TheBibleProject from './TheBibleProjectPlan'
import TimelineWidget from './TimelineWidget'
import UserWidget, { LoginPrompt } from './UserWidget'
import WordOfTheDay from './WordOfTheDay'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import TryAudibibleWidget from './TryAudibibleWidget'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Events } from './Events'
import ProfileStats from '~features/profile/components/ProfileStats'
import PassageMediaLibraryWidget from './PassageMediaLibraryWidget'
// local react props
type HomeProps = {
  closeHome: () => void
  inWorkspace?: boolean
}

export const Home = ({ closeHome, inWorkspace = false }: HomeProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const appleIsReviewing =
    Platform.OS === 'web' ? false : getValue(getRemoteConfig(), 'apple_reviewing').asBoolean()

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey flex-[1]">
      <HomeScrollView showsVerticalScrollIndicator={false}>
        <Events />
        <UserWidget />
        <ProfileStats />
        <LoginPrompt />
        <Box className="overflow-hidden border-continuous pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Apprendre')}
          </Text>
          <PassageMediaLibraryWidget />
          <HStack className="overflow-hidden border-continuous mt-[12px] h-[174px] gap-[12px] items-stretch">
            <TheBibleProject />
            <TimelineWidget />
          </HStack>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Étudier')}
          </Text>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[20px]">
          <RNScrollView
            horizontal
            style={{ overflow: 'visible' }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              overflow: 'visible',
            }}
          >
            <StrongOfTheDay type="grec" />
            <StrongOfTheDay type="hebreu" color1="rgba(248,131,121,1)" color2="rgba(255,77,93,1)" />
            <NaveOfTheDay />
            <WordOfTheDay color1="#ffd255" color2="#ffbc00" />
          </RNScrollView>
        </Box>
        <Box className="overflow-hidden border-continuous bg-light-grey pt-[40px] px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Méditer')}
          </Text>
        </Box>
        <VStack className="overflow-hidden border-continuous gap-[10px]">
          <PlanHome />
          <TryAudibibleWidget />
        </VStack>

        <Box className="overflow-hidden border-continuous bg-light-grey px-[20px]">
          <Text
            className="text-[23px] flex-[1]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Aller plus loin')}
          </Text>
        </Box>
        {!appleIsReviewing && <DonationWidget />}
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
  const closeHome = () => router.back()

  const isWide = useResponsiveWorkspace()
  return <Home closeHome={closeHome} inWorkspace={isWide} />
}
export default HomeScreen
