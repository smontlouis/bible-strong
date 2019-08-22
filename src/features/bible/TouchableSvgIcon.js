import React from 'react'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
}))

class TouchableSvgIcon extends React.Component {
  render() {
    const { onPress, isSelected, color, size = 20, icon: Icon, theme } = this.props
    return (
      <Touchable onPress={onPress}>
        <Icon
          width={size}
          height={size}
          color={theme.colors[color]}
          fill={isSelected ? theme.colors.primary : theme.colors.grey}
        />
      </Touchable>
    )
  }
}

export default withTheme(TouchableSvgIcon)
