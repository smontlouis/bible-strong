import { useSetAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { tabsAtomsAtom } from '../../../../state/tabs'

export interface AddTabButtonProps {}

const AddTabButton = ({}: AddTabButtonProps) => {
  const { t } = useTranslation()
  const dispatch = useSetAtom(tabsAtomsAtom)

  const onPress = () => {
    dispatch({
      type: 'insert',
      value: {
        id: `new-${Date.now()}`,
        title: t('tabs.new'),
        isRemovable: true,
        type: 'new',
        data: {},
      },
    })
  }

  return (
    <TouchableBox center size={TAB_ICON_SIZE} onPress={onPress}>
      <FeatherIcon name="plus" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default AddTabButton
