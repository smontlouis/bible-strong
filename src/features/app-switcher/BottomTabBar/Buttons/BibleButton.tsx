import { useAtomValue, useSetAtom } from 'jotai/react'
import React from 'react'
import { useSelector } from 'react-redux'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { RootState } from '~redux/modules/reducer'
import { activeTabIndexAtom, getDefaultBibleTab, tabsAtom } from '../../../../state/tabs'
import { getDefaultBibleVersionFromState } from '../../../../state/useDefaultBibleVersion'
import { TAB_ICON_SIZE } from '../../utils/constants'

export interface BibleButtonProps {}

const BibleButton = ({}: BibleButtonProps) => {
  const tabs = useAtomValue(tabsAtom)
  const setTabs = useSetAtom(tabsAtom)
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const defaultVersion = useSelector((state: RootState) => getDefaultBibleVersionFromState(state))

  // Find the first Bible tab (by type, not by id)
  const bibleIndex = tabs.findIndex(tab => tab.type === 'bible')
  const { slideToIndex } = useTabAnimations()

  const onPress = async () => {
    if (bibleIndex !== -1) {
      // If a Bible tab exists, navigate to it
      slideToIndex(bibleIndex)
    } else {
      // If no Bible tab exists, create one and navigate to it
      const newTab = getDefaultBibleTab(defaultVersion)
      setTabs(prev => [...prev, newTab])
      // Navigate to the new tab (will be at the end)
      setActiveTabIndex(tabs.length)
      slideToIndex(tabs.length)
    }
  }

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="book-open" size={23} color={'tertiary'} />
    </TouchableBox>
  )
}

export default BibleButton
