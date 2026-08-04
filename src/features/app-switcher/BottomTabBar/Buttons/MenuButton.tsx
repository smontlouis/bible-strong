import React from 'react'

import { FeatherIcon } from '~common/ui/Icon'
import { TouchableBox } from '../../../../common/ui/Box'
import { TAB_ICON_SIZE } from '../../utils/constants'

const MenuButton = ({ openMenu }: { openMenu: () => void }) => {
  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={openMenu}>
      <FeatherIcon name="more-horizontal" size={28} color="tertiary" />
    </TouchableBox>
  )
}

export default MenuButton
