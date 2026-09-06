import styled from '@emotion/native'
import React, { useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { alphabet } from '~helpers/alphabet'
import PageContent from '~common/ui/PageContent'

import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Theme } from '~themes'

const StyledText = styled(Text)<{ isSelected: boolean }>(({ isSelected }) => ({
  fontWeight: isSelected ? 'bold' : 'normal',
}))

const StyledUnderline = styled(Box)<{ color?: keyof Theme['colors'] }>(({ theme, color }) => ({
  marginTop: 5,
  height: 8,
  width: 30,
  borderRadius: 5,
  backgroundColor: color ? theme.colors[color] : theme.colors.primary,
}))

type AlphabetListProps = {
  color?: keyof Theme['colors']
  setLetter: (letter: string) => void
  letter: string
}

const AlphabetList = ({ color, setLetter, letter }: AlphabetListProps) => {
  const [width, setWidth] = useState(0)
  const CarouselAlphabet = useRef<ICarouselInstance>(null)
  const index = alphabet.findIndex(l => l === letter.toUpperCase())

  return (
    <Box background paddingBottom={7}>
      <Border />
      <PageContent
        paddingTop={5}
        height={50}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
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
            width,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
          itemWidth={36}
          itemHeight={44}
          data={alphabet}
          renderItem={({ item: section, index: itemIndex }) => (
            <TouchableOpacity
              accessibilityLabel={section.toUpperCase()}
              accessibilityRole="radio"
              accessibilityState={{ checked: letter === section }}
              onPress={() => {
                CarouselAlphabet.current?.scrollTo({ index: itemIndex, animated: true })
                setLetter(section)
              }}
              style={{ minWidth: 36, minHeight: 44, justifyContent: 'center' }}
            >
              <Box>
                <StyledText isSelected={letter === section} textAlign="center" fontSize={26}>
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
      </PageContent>
    </Box>
  )
}

export default AlphabetList
