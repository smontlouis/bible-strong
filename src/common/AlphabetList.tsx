import styled from '@emotion/native'
import React, { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { alphabet } from '~helpers/alphabet'
import { viewportWidth } from '~helpers/utils'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

// @ts-ignore
const StyledText = styled(Text)(({ theme, isSelected }: any) => ({
  fontWeight: isSelected ? 'bold' : 'normal',
}))

// @ts-ignore
const StyledUnderline = styled(Box)(({ theme, color }: any) => ({
  marginTop: 5,
  height: 8,
  width: 30,
  borderRadius: 5,
  // @ts-ignore
  backgroundColor: color ? theme.colors[color] : theme.colors.primary,
}))

const AlphabetList = ({ color, setLetter, letter }: any) => {
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
          onConfigurePanGesture={gestureChain => {
            gestureChain.activeOffsetX([-10, 10])
          }}
          style={{
            width: viewportWidth,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
          itemWidth={25}
          itemHeight={30}
          data={alphabet}
          renderItem={({ item: section, index: itemIndex }: any) => (
            <TouchableOpacity
              onPress={() => {
                CarouselAlphabet.current?.scrollTo({ index: itemIndex, animated: true })
                setLetter(section)
              }}
            >
              {/* @ts-ignore */}
              <Box isSelected={letter === section}>
                {/* @ts-ignore */}
                <StyledText isSelected={letter === section} textAlign="center" fontSize={26}>
                  {section.toUpperCase()}
                </StyledText>
              </Box>
            </TouchableOpacity>
          )}
          onSnapToItem={(index: any) => setLetter(alphabet[index])}
        />
        <Box center>
          {/* @ts-ignore */}
          <StyledUnderline color={color} />
        </Box>
      </Box>
    </Box>
  )
}

export default AlphabetList
