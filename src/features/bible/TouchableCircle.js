import React from 'react'
import styled from '@emotion/native'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}))

const Container = styled.View(({ color, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: color,
}))

const TouchableCircle = ({ color, onPress, size = 16, ...props }) => {
  return (
    <Touchable onPress={onPress}>
      <Container color={color} size={size} {...props} />
    </Touchable>
  )
}

export default TouchableCircle
