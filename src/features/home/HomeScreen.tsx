import React, { memo } from 'react'
import { Linking, ScrollView as RNScrollView } from 'react-native'
import Color from 'color'
import Box, { TouchableBox } from '~common/ui/Box'
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
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@emotion/react'

const HomeScreen = ({ closeHome }: { closeHome: () => void }) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Box grey flex={1}>
      <HomeScrollView showsVerticalScrollIndicator={false}>
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
            paddingHorizontal={20}
            paddingTop={20}
            paddingBottom={getBottomSpace() + 100}
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
        </Box>
      </HomeScrollView>
      <Box
        pos="absolute"
        left={0}
        right={0}
        bottom={0}
        height={100}
        paddingBottom={getBottomSpace()}
        center
      >
        <Box pos="absolute" top={0} bottom={0} left={0} right={0}>
          <LinearGradient
            start={[0.5, 0]}
            end={[0.5, 0.9]}
            style={{ height: 100 }}
            colors={[
              `${Color(theme.colors.lightGrey)
                .alpha(0)
                .string()}`,
              `${theme.colors.lightGrey}`,
            ]}
          />
        </Box>
        <TouchableBox
          center
          width={50}
          height={50}
          borderRadius={30}
          bg="reverse"
          lightShadow
          activeOpacity={0.8}
          onPress={closeHome}
        >
          <FeatherIcon name="x" size={24} color="grey" />
        </TouchableBox>
      </Box>
    </Box>
  )
}
export default memo(HomeScreen)
