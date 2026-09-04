import React from 'react'
import styled from '@emotion/native'
import { TouchableOpacityProps, ViewProps } from 'react-native'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}))

type CircleStyleProps = {
  color: string
  size: number
}

const Container = styled.View<CircleStyleProps>(({ color, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 3,
  backgroundColor: color,
}))

type TouchableCircleProps = ViewProps & {
  color: string
  onPress: TouchableOpacityProps['onPress']
  size?: number
}

const TouchableCircle = ({ color, onPress, size = 16, ...props }: TouchableCircleProps) => {
  return (
    <Touchable onPress={onPress}>
      <Container color={color} size={size} {...props} />
    </Touchable>
  )
}

export default TouchableCircle
