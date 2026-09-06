import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../../utils/constants'
export interface HomeButtonProps {
  openHome: () => void
}

const HomeButton = ({ openHome }: HomeButtonProps) => {
  const { t } = useTranslation()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous items-center justify-center"
      onPress={openHome}
      accessibilityRole="button"
      accessibilityLabel={t('accessibility.home')}
      style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
    >
      <FeatherIcon name="home" size={23} color="tertiary" />
    </TouchableBox>
  )
}

export default HomeButton
