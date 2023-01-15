import styled from '@emotion/native'
import Lottie from 'lottie-react-native'
import React, { useEffect, useRef } from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const Container = styled.View({
  flex: 1,
  alignItems: 'center',
})

interface Props {
  message: string
  source: any
}

const Empty = ({ message, source, ...props }: Props) => {
  const animation = useRef<Lottie>(null)
  useEffect(() => {
    if (animation.current) {
      animation.current.reset()
      animation.current.play()
    }
  }, [])

  return (
    <Container {...props}>
      <Box
        alignItems="center"
        justifyContent="center"
        // marginTop={source ? 100 : 0}
        flex
        paddingHorizontal={20}
      >
        {source && (
          <Lottie
            ref={animation}
            style={{
              width: '100%',
              height: 200,
              marginBottom: 20,
            }}
            source={source}
          />
        )}
        {message && (
          <Text textAlign="center" color="tertiary">
            {message}
          </Text>
        )}
      </Box>
    </Container>
  )
}

export default Empty
