import React, { memo } from 'react'
import { Linking, ScrollView as RNScrollView } from 'react-native'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { HomeScrollView } from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import NaveOfTheDay from './NaveOfTheDay'
import PlanHome from './PlanHome'
import PremiumWidget from './PremiumWidget'
import StrongOfTheDay from './StrongOfTheDay'
import TheBibleProject from './TheBibleProjectPlan'
import TimelineWidget from './TimelineWidget'
import UserWidget from './UserWidget'
import WordOfTheDay from './WordOfTheDay'

import { useTranslation } from 'react-i18next'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import BackBottomTabBar from '~features/app-switcher/BottomTabBar/BackBottomTabBar'

const HomeScreen = ({ closeHome }: { closeHome: () => void }) => {
  const { t } = useTranslation()

  return (
    <Box grey>
      <HomeScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: getBottomSpace() + TAB_ICON_SIZE + 20,
        }}
      >
        <UserWidget />
        <Box grey pt={20} px={20}>
          <Text title fontSize={23} flex>
            {t('Apprendre')}
          </Text>
          <TheBibleProject />
          <TimelineWidget />
        </Box>
        <Box grey pt={40} px={20}>
          <Text title fontSize={23} flex>
            {t('Étudier')}
          </Text>
        </Box>
        <Box grey paddingTop={20}>
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
            <StrongOfTheDay
              type="hebreu"
              color1="rgba(248,131,121,1)"
              color2="rgba(255,77,93,1)"
            />
            <NaveOfTheDay />
            <WordOfTheDay color1="#ffd255" color2="#ffbc00" />
          </RNScrollView>
        </Box>
        <Box grey pt={40} px={20}>
          <Text title fontSize={23} flex>
            {t('Méditer')}
          </Text>
        </Box>
        <PlanHome />
        <Box grey pt={40} px={20}>
          <Text title fontSize={23} flex>
            {t('Aller plus loin')}
          </Text>
        </Box>
        <PremiumWidget />
        <Box grey>
          <Box
            background
            row
            padding={20}
            style={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}
          >
            <Box flex>
              <Button
                color="#3b5998"
                onPress={() =>
                  Linking.openURL('https://www.facebook.com/fr.bible.strong')
                }
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
            <Box width={20} />
            <Box flex>
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
          {/* {Platform.OS === 'android' && (
            <Box background p={20} pt={0}>
              <Button
                color="#7ed6df"
                title="Soutenir"
                route="Support"
                leftIcon={
                  <FeatherIcon
                    name="thumbs-up"
                    size={20}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                }
              />
            </Box>
          )} */}
        </Box>
      </HomeScrollView>
      <BackBottomTabBar onClose={closeHome} direction="right" />
    </Box>
  )
}
export default memo(HomeScreen)
