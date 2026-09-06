import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '../utils/constants'
type BackBottomTabBarProps = {
  onClose: () => void
  direction: 'left' | 'right'
}

const BackBottomTabBar = ({ onClose, direction }: BackBottomTabBarProps) => {
  const { t } = useTranslation()

  return (
    <Box
      className="border-continuous overflow-hidden flex-row bg-reverse px-[20px] items-center absolute bottom-[0px] left-[0px] right-[0px] border-t-[1px] border-border"
      style={{
        paddingBottom: useSafeAreaInsets().bottom,
        justifyContent: direction === 'left' ? 'flex-start' : 'flex-end',
      }}
    >
      <TouchableBox
        className="overflow-hidden border-continuous items-center justify-center"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.back')}
        style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
      >
        <FeatherIcon
          name={direction === 'left' ? 'arrow-left' : 'arrow-right'}
          size={23}
          color="tertiary"
        />
      </TouchableBox>
    </Box>
  )
}

export default BackBottomTabBar
