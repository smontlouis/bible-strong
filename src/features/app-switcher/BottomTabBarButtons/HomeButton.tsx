import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../utils/constants'

export interface HomeButtonProps {
  openHome: () => void
}

const HomeButton = ({ openHome }: HomeButtonProps) => {
  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={openHome}>
      <FeatherIcon name="home" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default HomeButton
