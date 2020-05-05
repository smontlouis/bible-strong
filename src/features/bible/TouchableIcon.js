import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Text from '~common/ui/Text'

const Touchable = styled.TouchableOpacity(({ noFlex, disabled }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.3 : 1,
  ...(!noFlex && { flex: 1 }),
}))

const StyledIcon = styled(Icon.Feather)(
  ({ color, isSelected, theme, disabled }) => ({
    color: disabled
      ? theme.colors.grey
      : theme.colors[color] || theme.colors.tertiary,
    ...(isSelected && {
      color: theme.colors.primary,
    }),
  })
)

export default class TabBarIcon extends React.Component {
  render() {
    const {
      onPress,
      color,
      isSelected,
      size = 20,
      noFlex = false,
      label,
      disabled,
      ...props
    } = this.props
    return (
      <Touchable
        onPress={onPress}
        noFlex={noFlex}
        disabled={disabled}
        {...props}
      >
        <StyledIcon
          name={this.props.name}
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
}
