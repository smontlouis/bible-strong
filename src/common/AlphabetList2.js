import React, { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Carousel from 'react-native-snap-carousel'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { viewportWidth } from '~helpers/utils'
import { alphabet } from '~helpers/alphabet'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'

const StyledText = styled(Text)(({ theme, isSelected }) => ({
  fontWeight: isSelected ? 'bold' : 'normal',
}))

const StyledUnderline = styled(Box)(({ theme, color }) => ({
  marginTop: 5,
  height: 8,
  width: 30,
  borderRadius: 5,
  backgroundColor: color ? theme.colors[color] : theme.colors.primary,
}))

const AlphabetList = ({ color, setLetter, letter }) => {
  const CarouselAlphabet = useRef()
  const index = alphabet.findIndex(l => l === letter.toUpperCase())

  return (
    <Box background paddingBottom={7 + getBottomSpace()}>
      <Border />
      <Box paddingTop={5}>
        <Carousel
          ref={CarouselAlphabet}
          firstItem={index}
          data={alphabet}
          renderItem={({ item: section }) => (
            <TouchableOpacity
              onPress={() => {
                setLetter(section)
              }}
            >
              <Box isSelected={letter === section}>
                <StyledText
                  isSelected={letter === section}
                  textAlign="center"
                  fontSize={23}
                >
                  {section.toUpperCase()}
                </StyledText>
              </Box>
            </TouchableOpacity>
          )}
          sliderWidth={viewportWidth}
          itemWidth={25}
          itemHeight={25}
          inactiveSlideScale={0.7}
          inactiveSlideOpacity={0.8}
          onSnapToItem={index => setLetter(alphabet[index])}
          activeSlideOffset={2}
          enableMomentum
          decelerationRate={0.9}
        />
        <Box center>
          <StyledUnderline color={color} />
        </Box>
      </Box>
    </Box>
  )
}

export default AlphabetList
