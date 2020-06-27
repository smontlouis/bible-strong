import React from 'react'
import { ScrollView as RNScrollView, Linking, Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { HomeScrollView } from '~common/ui/ScrollView'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import NaveOfTheDay from './NaveOfTheDay'
import UserWidget from './UserWidget'
import Button from '~common/ui/Button'
import PlanHome from './PlanHome'
import TimelineWidget from './TimelineWidget'
import PremiumWidget from './PremiumWidget'
import SwitchTheme from './SwitchTheme'
import TheBibleProject from './TheBibleProjectPlan'

import { useTranslation } from 'react-i18next'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({}))

const HomeScreen = () => {
  const { t } = useTranslation()
  return (
    <Box grey>
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
        <Box grey pb={30}>
          <SwitchTheme />
        </Box>
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
    </Box>
  )
}
export default HomeScreen
