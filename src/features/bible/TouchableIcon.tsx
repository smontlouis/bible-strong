import React from 'react'
import * as Icon from '@expo/vector-icons'

import Text from '~common/ui/Text'
import styled from '@emotion/native'
import { TouchableOpacityProps } from 'react-native'

const Touchable = styled.TouchableOpacity<{
  noFlex?: boolean
  disabled?: boolean
}>(({ noFlex, disabled }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.3 : 1,
  ...(!noFlex && { flex: 1 }),
}))

const StyledIcon = styled(Icon.Feather)<{
  color?: string
  isSelected?: boolean
  disabled?: boolean
}>(({ color, isSelected, theme, disabled }) => ({
  color: disabled
    ? theme.colors.grey
    : theme.colors[color as keyof typeof theme.colors] || theme.colors.tertiary,
  ...(isSelected && {
    color: theme.colors.primary,
  }),
}))

export default ({
  onPress,
  color,
  isSelected,
  size = 20,
  noFlex = false,
  label,
  disabled,
  name,
  ...props
}: {
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  noFlex?: boolean
  label?: string
  disabled?: boolean
  name: string
} & TouchableOpacityProps) => {
  return (
    <Touchable onPress={onPress} noFlex={noFlex} disabled={disabled} {...props}>
      <StyledIcon
        name={name}
        size={size}
        color={color}
        isSelected={isSelected}
        disabled={disabled}
      />
      {label && (
        <Text marginTop={5} fontSize={9} color="grey">
          {label}
        </Text>
      )}
    </Touchable>
  )
}
