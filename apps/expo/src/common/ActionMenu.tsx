import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentProps } from 'react'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
type FeatherIconName = ComponentProps<typeof FeatherIcon>['name']

type ActionMenuContentProps = {
  icon: FeatherIconName
  label: string
  color?: string
}

type ActionSheetItemProps = ActionMenuContentProps & {
  onPress: () => void
  nested?: boolean
}

export const ActionMenuContent = ({ icon, label, color = 'default' }: ActionMenuContentProps) => {
  const stylingTheme = useStylingTheme()
  return (
    <Box className="overflow-hidden border-continuous flex-row items-center">
      <Box className="overflow-hidden border-continuous w-[20px] items-center">
        <FeatherIcon name={icon} size={15} color={color} />
      </Box>
      <Text
        className="ml-[10px]"
        style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
      >
        {label}
      </Text>
    </Box>
  )
}

export const ActionSheetItem = ({ icon, label, color, onPress, nested }: ActionSheetItemProps) => (
  <TouchableBox
    className="border-continuous overflow-visible flex-row items-center justify-between p-[20px] border-b-[1px] border-border"
    onPress={onPress}
  >
    <ActionMenuContent icon={icon} label={label} color={color} />
    {nested && <FeatherIcon name="chevron-right" size={20} color="tertiary" />}
  </TouchableBox>
)
