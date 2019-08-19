import React, { useRef, useEffect } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Carousel from 'react-native-snap-carousel'
import { viewportWidth } from '~helpers/utils'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'

const StyledItem = styled(Box)(({ theme, isSelected }) => ({}))

const StyledText = styled(Text)(({ theme, isSelected }) => ({
  fontWeight: isSelected ? 'bold' : 'normal'
}))

const StyledUnderline = styled(Box)(({ theme }) => ({
  marginTop: 5,
  height: 8,
  width: 30,
  borderRadius: 5,
  backgroundColor: theme.colors.primary
}))

const AlphabetList = ({ onPress, sectionIndex, alphabet }) => {
  const CarouselAlphabet = useRef()

  return (
    <Box paddingBottom={7}>
      <Border />
      <Box paddingTop={5}>
        <Carousel
          ref={CarouselAlphabet}
          firstItem={sectionIndex}
          data={alphabet}
          renderItem={({ item: section }) => (
            <TouchableOpacity
              onPress={() => {
                onPress(alphabet.findIndex(l => l === section))
              }}>
              <StyledItem isSelected={sectionIndex === alphabet.findIndex(l => l === section)}>
                <StyledText
                  isSelected={sectionIndex === alphabet.findIndex(l => l === section)}
                  textAlign="center"
                  fontSize={23}>
                  {section}
                </StyledText>
              </StyledItem>
            </TouchableOpacity>
          )}
          sliderWidth={viewportWidth}
          itemWidth={25}
          itemHeight={25}
          inactiveSlideScale={0.7}
          inactiveSlideOpacity={0.8}
          onSnapToItem={index => onPress(index)}
          activeSlideOffset={2}
          enableMomentum
          decelerationRate={0.9}
        />
        <Box center>
          <StyledUnderline />
        </Box>
      </Box>
    </Box>
  )
}

export default AlphabetList
