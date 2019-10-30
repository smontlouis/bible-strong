import React from 'react'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Text from '~common/ui/Text'

const Touchable = styled.TouchableOpacity(({ disabled }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.3 : 1
}))

class TouchableSvgIcon extends React.Component {
  render() {
    const { onPress, isSelected, color, size = 20, icon: Icon, theme, label, disabled } = this.props
    return (
      <Touchable onPress={onPress} disabled={disabled}>
        <Icon
          width={size}
          height={size}
          color={disabled ? theme.colors.grey : theme.colors[color]}
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
}

export default withTheme(TouchableSvgIcon)
