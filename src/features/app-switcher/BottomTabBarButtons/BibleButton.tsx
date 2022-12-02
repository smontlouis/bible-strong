import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../utils/constants'
import useBibleButtonPress from './useBibleButtonPress'

export interface BibleButtonProps {}

const BibleButton = ({}: BibleButtonProps) => {
  const { onPress, isActive } = useBibleButtonPress()
  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="book-open" size={23} color={'tertiary'} />
    </TouchableBox>
  )
}

export default BibleButton
