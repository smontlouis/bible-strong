import styled from '@emotion/native'
import React, { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { alphabet } from '~helpers/alphabet'
import { viewportWidth } from '~helpers/utils'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

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
  const CarouselAlphabet = useRef<ICarouselInstance>(null)
  const index = alphabet.findIndex(l => l === letter.toUpperCase())

  return (
    <Box background paddingBottom={7}>
      <Border />
      <Box paddingTop={5} height={50}>
        <Carousel
          ref={CarouselAlphabet}
          mode="parallax"
          loop={false}
          defaultIndex={index}
          scrollAnimationDuration={200}
          modeConfig={{
            parallaxScrollingOffset: 0,
            parallaxScrollingScale: 0.75,
          }}
          panGestureHandlerProps={{
            activeOffsetX: [-10, 10],
          }}
          style={{
            width: viewportWidth,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          width={25}
          height={30}
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
                  fontSize={26}
                >
                  {section.toUpperCase()}
                </StyledText>
              </Box>
            </TouchableOpacity>
          )}
          onSnapToItem={index => setLetter(alphabet[index])}
        />
        <Box center>
          <StyledUnderline color={color} />
        </Box>
      </Box>
    </Box>
  )
}

export default AlphabetList
