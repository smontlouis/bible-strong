import styled from '@emotion/native'
import { useTheme, withTheme } from '@emotion/react'
import React, { ComponentType } from 'react'

import Text from '~common/ui/Text'

type SvgIconComponentProps = {
  width?: number
  height?: number
  size?: number
  color?: string
  fill?: string
}

const Touchable = styled.TouchableOpacity(({ disabled }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.3 : 1,
}))

const TouchableSvgIcon = ({
  onPress,
  isSelected,
  color,
  size = 20,
  icon: Icon,
  label,
  disabled,
}: {
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  icon: ComponentType<SvgIconComponentProps>
  noFlex?: boolean
  label?: string
  disabled?: boolean
}) => {
  const theme = useTheme()
  return (
    <Touchable onPress={onPress} disabled={disabled}>
      <Icon
        width={size}
        height={size}
        color={
          disabled ? theme.colors.grey : theme.colors[color as keyof typeof theme.colors] || color
        }
        fill={isSelected ? theme.colors.primary : theme.colors.grey}
      />
      {label && (
        <Text marginTop={5} fontSize={9} color="grey">
          {label}
        </Text>
      )}
    </Touchable>
  )
}

export default withTheme(TouchableSvgIcon)
