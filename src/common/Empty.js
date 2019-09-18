import React from 'react'
import { pure } from 'recompose'
import Lottie from 'lottie-react-native'
import styled from '@emotion/native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const Container = styled.View({
  flex: 1,
  alignItems: 'center'
})

class Empty extends React.Component {
  componentDidMount() {
    if (this.animation) {
      this.animation.reset()
      this.animation.play()
    }
  }

  render() {
    const { message, source, ...props } = this.props
    return (
      <Container {...props}>
        <Box
          alignItems="center"
          justifyContent="center"
          marginTop={source ? 100 : 0}
          flex
          paddingHorizontal={20}>
          {source && (
            <Lottie
              ref={animation => {
                this.animation = animation
              }}
              style={{
                width: '100%',
                height: 200,
                marginBottom: 20
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
}

export default pure(Empty)
