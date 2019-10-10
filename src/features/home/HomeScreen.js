import React from 'react'
import { ScrollView as RNScrollView } from 'react-native'
import RoundedCorner from '~common/ui/RoundedCorner'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'

import VerseOfTheDay from './VerseOfTheDay'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import UserWidget from './UserWidget'

const HomeScreen = () => {
  return (
    <Box grey>
      <ScrollView>
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
        <Box grey>
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
            <StrongOfTheDay type="grec" />
            <StrongOfTheDay type="hebreu" color1="rgba(248,131,121,1)" color2="rgba(255,77,93,1)" />
            <WordOfTheDay color1="rgba(255,197,61,0.7)" color2="rgb(255,188,0)" />
          </RNScrollView>
        </Box>
      </ScrollView>
    </Box>
  )
}
export default HomeScreen
