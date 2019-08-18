import React, { useRef, useEffect } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Carousel from 'react-native-snap-carousel'
import { viewportWidth } from '~helpers/utils'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { alphabet } from '~helpers/alphabet'

const StyledItem = styled(Box)(({ theme, isSelected }) => ({
  fontWeight: isSelected ? 'bold' : 'normal'
}))

const AlphabetList = ({ onPress, sectionIndex }) => {
  const CarouselAlphabet = useRef()

  useEffect(() => {
    CarouselAlphabet.current.snapToItem(sectionIndex)
  }, [sectionIndex])

  return (
    <Box paddingTop={15} paddingBottom={15}>
      <Carousel
        ref={CarouselAlphabet}
        // loop
        // loopClonesPerSide={100}
        data={alphabet}
        renderItem={({ item: section }) => (
          <TouchableOpacity
            onPress={() => {
              onPress(alphabet.findIndex(l => l === section))
            }}>
            <StyledItem isSelected={sectionIndex === alphabet.findIndex(l => l === section)}>
              <Text textAlign="center" fontSize={23}>
                {section}
              </Text>
            </StyledItem>
          </TouchableOpacity>
        )}
        sliderWidth={viewportWidth}
        itemWidth={25}
        itemHeight={25}
        inactiveSlideScale={0.6}
        inactiveSlideOpacity={0.8}
        // onSnapToItem={index => console.log('COUCOU', index)}
        activeSlideOffset={2}
        enableMomentum
        decelerationRate={0.9}
      />
    </Box>
  )
}

export default AlphabetList
