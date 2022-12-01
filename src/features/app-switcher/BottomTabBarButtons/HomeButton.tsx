import React from 'react'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../utils/constants'

export interface HomeButtonProps {
  navigation: NavigationStackProp
}

const HomeButton = ({ navigation }: HomeButtonProps) => {
  return (
    <TouchableBox
      center
      size={TAB_ICON_SIZE}
      onPress={() => navigation.navigate('Home')}
    >
      <FeatherIcon name="home" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default withNavigation(HomeButton)
