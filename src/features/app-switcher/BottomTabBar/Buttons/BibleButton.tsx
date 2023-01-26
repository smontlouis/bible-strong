import { useAtomValue } from 'jotai/react'
import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { tabsAtom } from '../../../../state/tabs'
import { TAB_ICON_SIZE } from '../../utils/constants'

export interface BibleButtonProps {}

const BibleButton = ({}: BibleButtonProps) => {
  const tabs = useAtomValue(tabsAtom)
  const bibleIndex = tabs.findIndex(tab => tab.id === 'bible')
  const { slideToIndex } = useTabAnimations()

  const onPress = async () => {
    slideToIndex(bibleIndex)
  }

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="book-open" size={23} color={'tertiary'} />
    </TouchableBox>
  )
}

export default BibleButton
