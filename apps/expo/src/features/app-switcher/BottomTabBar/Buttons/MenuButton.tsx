import React from 'react'
import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import { TouchableBox } from '../../../../common/ui/Box'
import { TAB_ICON_SIZE } from '../../utils/constants'
const MenuButton = ({ openMenu }: { openMenu: () => void }) => {
  const { t } = useTranslation()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous items-center justify-center"
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={t('accessibility.mainMenu')}
      style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
    >
      <FeatherIcon name="more-horizontal" size={28} color="tertiary" />
    </TouchableBox>
  )
}

export default MenuButton
