import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

const Touchable = styled.TouchableOpacity(({ noFlex }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  ...!noFlex && { flex: 1 }
}))

const StyledIcon = styled(Icon.Feather)(({ color, isSelected, theme }) => ({
  color: color || theme.colors.grey,
  ...isSelected && {
    color: theme.colors.primary
  }
}))

export default class TabBarIcon extends React.Component {
  render () {
    const { onPress, color, isSelected, size = 20, noFlex = false } = this.props
    return (
      <Touchable onPress={onPress} noFlex={noFlex}>
        <StyledIcon
          name={this.props.name}
          size={size}
          color={color}
          isSelected={isSelected}
        />
      </Touchable>
    )
  }
}
