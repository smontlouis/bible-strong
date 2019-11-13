import React from 'react'
import { ScrollView as RNScrollView, Linking } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import RoundedCorner from '~common/ui/RoundedCorner'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { HomeScrollView } from '~common/ui/ScrollView'
import VerseOfTheDay from './VerseOfTheDay'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import NaveOfTheDay from './NaveOfTheDay'
import UserWidget from './UserWidget'
import Button from '~common/ui/Button'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({}))

const HomeScreen = () => {
  return (
    <Box grey>
      <HomeScrollView showsVerticalScrollIndicator={false}>
        <UserWidget />
        <Box grey>
          <RoundedCorner />
        </Box>
        <VerseOfTheDay />
        <Box padding={20} paddingBottom={0} grey>
          <Text title fontSize={25}>
            Au hasard
          </Text>
        </Box>
        <Box grey paddingBottom={30}>
          <RNScrollView
            horizontal
            style={{ overflow: 'visible' }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              paddingVertical: 10,
              overflow: 'visible'
            }}>
            <NaveOfTheDay />
            <StrongOfTheDay type="grec" />
            <StrongOfTheDay type="hebreu" color1="rgba(248,131,121,1)" color2="rgba(255,77,93,1)" />
            <WordOfTheDay color1="rgba(255,197,61,0.7)" color2="rgb(255,188,0)" />
          </RNScrollView>
        </Box>
        <Box grey>
          <Box
            background
            row
            padding={20}
            style={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
            <Box flex>
              <Button
                color="#3b5998"
                onPress={() => Linking.openURL('https://www.facebook.com/fr.bible.strong')}
                title="Suivre"
                leftIcon={
                  <FeatherIcon
                    name="facebook"
                    size={20}
                    color="white"
                    style={{ marginRight: 10 }}
                  />
                }
              />
            </Box>
            <Box width={20} />
            <Box flex>
              <Button
                color="#7ed6df"
                route="Support"
                title="Soutenir"
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
          </Box>
          <Box background padding={20} paddingTop={0}>
            <Button
              color="#2ecc71"
              route="FAQ"
              title="Foire aux questions"
              leftIcon={
                <FeatherIcon
                  name="help-circle"
                  size={20}
                  color="white"
                  style={{ marginRight: 10 }}
                />
              }
            />
          </Box>
        </Box>
      </HomeScrollView>
    </Box>
  )
}
export default HomeScreen
