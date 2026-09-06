import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { TAB_ICON_SIZE } from '../../utils/constants'
import useTabButtonPress from './useTabButtonPress'
import { getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
const TabButton = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const { onPress, tabsCount, iconStyle, groupColor } = useTabButtonPress()
  const { colorScheme } = useCurrentThemeSelector()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous items-center justify-center"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('accessibility.tabs', { count: tabsCount })}
      style={{ ...(TAB_ICON_SIZE ? { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE } : {}) }}
    >
      <AnimatedBox
        className="overflow-hidden border-continuous border-[2px] rounded-[5px] items-center justify-center"
        style={[
          {
            backgroundColor: resolveThemeColor(stylingTheme, groupColor),
            borderColor: resolveThemeColor(stylingTheme, groupColor || 'tertiary'),
            width: 20,
            height: 20,
          },
          iconStyle,
        ]}
      >
        <Text
          className="text-[12px] leading-[15px]"
          style={{
            color:
              resolveThemeColor(
                stylingTheme,
                groupColor ? getContrastTextColor(groupColor, colorScheme === 'dark') : 'tertiary'
              ) || stylingTheme.colors.default,
          }}
        >
          {tabsCount > 100 ? ':)' : tabsCount}
        </Text>
      </AnimatedBox>
    </TouchableBox>
  )
}

export default TabButton
