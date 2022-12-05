import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../../utils/constants'
import useSearchButtonPress from './useSearchButton'

export interface SearchButtonProps {}

const SearchButton = ({}: SearchButtonProps) => {
  const { onPress } = useSearchButtonPress()

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="search" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default SearchButton
