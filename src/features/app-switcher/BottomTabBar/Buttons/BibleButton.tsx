import { useAtomValue } from 'jotai'
import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import useSlideToIndex from '~features/app-switcher/utils/useSlideToIndex'
import { tabsAtom } from '../../../../state/tabs'
import { TAB_ICON_SIZE } from '../../utils/constants'

export interface BibleButtonProps {}

const BibleButton = ({}: BibleButtonProps) => {
  const tabs = useAtomValue(tabsAtom)
  const bibleIndex = tabs.findIndex(tab => tab.id === 'bible')
  const slideToIndex = useSlideToIndex()

  const onPress = () => {
    slideToIndex(bibleIndex)
  }

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="book-open" size={23} color={'tertiary'} />
    </TouchableBox>
  )
}

export default BibleButton
