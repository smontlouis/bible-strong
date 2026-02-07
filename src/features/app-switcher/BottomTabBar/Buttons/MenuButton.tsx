import React from 'react'
import { useSelector } from 'react-redux'

import { FeatherIcon } from '~common/ui/Icon'
import PulsingDot from '~common/ui/PulsingDot'
import { RootState } from '~redux/modules/reducer'
import { TouchableBox } from '../../../../common/ui/Box'
import { TAB_ICON_SIZE } from '../../utils/constants'

const MenuButton = ({ openMenu }: { openMenu: () => void }) => {
  const hasUpdate = useSelector((state: RootState) =>
    Object.values(state.user.needsUpdate).some(v => v)
  )

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={openMenu}>
      <FeatherIcon name="more-horizontal" size={28} color="tertiary" />

      {hasUpdate && <PulsingDot style={{ position: 'absolute', top: 0, right: -3 }} />}
    </TouchableBox>
  )
}

export default MenuButton
