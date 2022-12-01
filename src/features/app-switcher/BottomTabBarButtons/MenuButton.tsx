import styled from '@emotion/native'
import React from 'react'
import * as Animatable from 'react-native-animatable'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import { useSelector } from 'react-redux'

import { FeatherIcon } from '~common/ui/Icon'
import { RootState } from '~redux/modules/reducer'
import { TouchableBox } from '../../../common/ui/Box'
import { TAB_ICON_SIZE } from '../utils/constants'

const Circle = styled.View(({ theme }) => ({
  position: 'absolute',
  width: 10,
  height: 10,
  borderRadius: 10,
  top: 0,
  right: -3,
  backgroundColor: theme.colors.success,
}))

const AnimatedCircle = Animatable.createAnimatableComponent(Circle)

const MenuButton = ({ navigation }: { navigation: NavigationStackProp }) => {
  const hasUpdate = useSelector((state: RootState) =>
    Object.values(state.user.needsUpdate).some(v => v)
  )

  return (
    <TouchableBox
      center
      size={TAB_ICON_SIZE}
      onPress={() => navigation.navigate('More')}
    >
      <FeatherIcon name="menu" size={23} color="tertiary" />

      {hasUpdate && (
        <AnimatedCircle
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
        />
      )}
    </TouchableBox>
  )
}

export default withNavigation(MenuButton)
