import React from 'react'
import styled from '@emotion/native'

const Container = styled.TouchableOpacity(({ color }) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: color
}))

const TouchableCircle = ({ color, onPress }) => {
  return (
    <Container color={color} onPress={onPress} />
  )
}

export default TouchableCircle
