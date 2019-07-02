import React from 'react'
import styled from '@emotion/native'

const Touchable = styled.TouchableOpacity(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
}))

export default class TouchableSvgIcon extends React.Component {
  render () {
    const { onPress, isSelected, size = 20, icon: Icon } = this.props
    return (
      <Touchable onPress={onPress}>
        <Icon
          width={size}
          height={size}
          fill={isSelected ? 'rgb(9,132,227)' : 'rgb(78,79,79)'}
        />
      </Touchable>
    )
  }
}
