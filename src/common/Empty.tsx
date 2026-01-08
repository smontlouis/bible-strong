import { useTheme } from '@emotion/react'
import styled from '@emotion/native'
import { Image, ImageSource } from 'expo-image'
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
  source?: any
  icon?: ImageSource
}

const Empty = ({ message, source, icon, ...props }: Props) => {
  const theme = useTheme()
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
        flex
        paddingHorizontal={20}
      >
        {icon && (
          <Box mb={20}>
            <Image
              source={icon}
              style={{ width: 80, height: 80 }}
              tintColor={theme.colors.tertiary}
              contentFit="contain"
            />
          </Box>
        )}
        {source && !icon && (
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
