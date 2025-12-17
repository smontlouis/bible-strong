import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Text from '~common/ui/Text'

const Touchable = styled.TouchableOpacity(({ disabled, theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.3 : 1,
  marginRight: 10,
  backgroundColor: theme.colors.lightPrimary,
  height: 30,
  paddingHorizontal: 10,
  borderRadius: 20,
}))

const StyledIcon = styled(Icon.Feather)<{ isSelected?: boolean }>(
  // @ts-ignore
  ({ color, isSelected, theme, disabled }: any) => ({
    marginRight: 8,
    color: disabled ? theme.colors.grey : theme.colors[color] || theme.colors.primary,
    ...(isSelected && {
      color: theme.colors.primary,
    }),
  })
)

type Props = {
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  label?: string
  disabled?: boolean
  name?: any
}

export default ({ onPress, color, isSelected, size = 17, label, disabled, name }: Props) => {
  return (
    <Touchable onPress={onPress} disabled={disabled}>
      {name && (
        <StyledIcon
          name={name}
          size={size}
          color={color}
          isSelected={isSelected}
          disabled={disabled}
        />
      )}
      {label && (
        <Text fontSize={13} color="primary">
          {label}
        </Text>
      )}
    </Touchable>
  )
}
