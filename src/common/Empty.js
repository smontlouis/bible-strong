import React from 'react'
import { pure } from 'recompose'
import { DangerZone } from 'expo'
import styled from '@emotion/native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
let { Lottie } = DangerZone

const Container = styled.View({
  flex: 1,
  alignItems: 'center'
})

class Empty extends React.Component {
  componentDidMount () {
    this.animation.reset()
    this.animation.play()
  }
  render () {
    const { message, source } = this.props
    return (
      <Container>
        <Box alignItems='center' marginTop={100}>
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
          {message && <Text tertiary>{message}</Text>}
        </Box>
      </Container>
    )
  }
}

export default pure(Empty)
