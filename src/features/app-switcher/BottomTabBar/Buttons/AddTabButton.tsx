import { useSetAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { useExpandNewTab } from '~features/app-switcher/utils/useExpandNewTab'
import { tabsAtomsAtom } from '../../../../state/tabs'

export interface AddTabButtonProps {}

const AddTabButton = ({}: AddTabButtonProps) => {
  const { t } = useTranslation()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerExpandNewTab } = useExpandNewTab()

  const onPress = () => {
    const newTabId = `new-${Date.now()}`
    dispatchTabs({
      type: 'insert',
      value: {
        id: newTabId,
        title: t('tabs.new'),
        isRemovable: true,
        type: 'new',
        data: {},
      },
    })
    triggerExpandNewTab(newTabId)
  }

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="plus" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default AddTabButton
