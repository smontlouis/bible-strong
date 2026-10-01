import React from 'react'
import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import NotificationDot from '~common/ui/NotificationDot'
import { useAvailableUpdatesIndicator } from '~features/resources/useAvailableUpdates'
import Box, { TouchableBox } from '../../../../common/ui/Box'
import { TAB_ICON_SIZE } from '../../utils/constants'
const MenuButton = ({ openMenu }: { openMenu: () => void }) => {
  const { t } = useTranslation()
  const { hasUnseenUpdates } = useAvailableUpdatesIndicator()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous items-center justify-center"
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnseenUpdates ? t('accessibility.mainMenuWithUpdates') : t('accessibility.mainMenu')
      }
      style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
    >
      <Box>
        <FeatherIcon name="more-horizontal" size={28} color="tertiary" />
        {hasUnseenUpdates && (
          <NotificationDot style={{ position: 'absolute', top: 2, right: -3 }} />
        )}
      </Box>
    </TouchableBox>
  )
}

export default MenuButton
