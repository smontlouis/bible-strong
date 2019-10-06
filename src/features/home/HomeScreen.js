import React from 'react'
import { ScrollView } from 'react-native'

import Container from '~common/ui/Container'
import RoundedCorner from '~common/ui/RoundedCorner'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import VerseOfTheDay from './VerseOfTheDay'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import UserWidget from './UserWidget'

const DLScreen = () => {
  return (
    <Container>
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
          <ScrollView
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
          </ScrollView>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default DLScreen
