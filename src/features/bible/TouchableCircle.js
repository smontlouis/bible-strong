import React from 'react'
import styled from '@emotion/native'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
}))

const Container = styled.View(({ color }) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: color
}))

const TouchableCircle = ({ color, onPress }) => {
  return (
    <Touchable onPress={onPress}>
      <Container color={color} />
    </Touchable>
  )
}

export default TouchableCircle
