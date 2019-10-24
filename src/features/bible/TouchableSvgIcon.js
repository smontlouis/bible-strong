import React from 'react'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Text from '~common/ui/Text'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
}))

class TouchableSvgIcon extends React.Component {
  render() {
    const { onPress, isSelected, color, size = 20, icon: Icon, theme, label } = this.props
    return (
      <Touchable onPress={onPress}>
        <Icon
          width={size}
          height={size}
          color={theme.colors[color]}
          fill={isSelected ? theme.colors.primary : theme.colors.grey}
        />
        {label && (
          <Text marginTop={5} fontSize={10} color="grey">
            {label}
          </Text>
        )}
      </Touchable>
    )
  }
}

export default withTheme(TouchableSvgIcon)
