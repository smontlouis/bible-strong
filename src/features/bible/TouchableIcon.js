import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
}))

const StyledIcon = styled(Icon.Feather)(({ color, isSelected, theme }) => ({
  color: color || theme.colors.grey,
  ...isSelected && {
    color: theme.colors.primary
  }
}))

export default class TabBarIcon extends React.Component {
  render () {
    const { onPress, color, isSelected, size = 20 } = this.props
    return (
      <Touchable onPress={onPress}>
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
