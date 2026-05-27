import type { ComponentProps } from 'react'
import MenuOption from '~common/ui/MenuOption'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

type FeatherIconName = ComponentProps<typeof FeatherIcon>['name']

type ActionMenuContentProps = {
  icon: FeatherIconName
  label: string
  color?: string
}

type ActionMenuOptionProps = ActionMenuContentProps & {
  onSelect?: (value?: unknown) => void
  closeOnSelect?: boolean
  closeBeforeSelect?: boolean
}

type ActionSheetItemProps = ActionMenuContentProps & {
  onPress: () => void
}

export const ActionMenuContent = ({ icon, label, color = 'default' }: ActionMenuContentProps) => (
  <Box row alignItems="center">
    <Box width={20} alignItems="center">
      <FeatherIcon name={icon} size={15} color={color} />
    </Box>
    <Text marginLeft={10} color={color}>
      {label}
    </Text>
  </Box>
)

export const ActionMenuOption = ({
  icon,
  label,
  color,
  onSelect,
  closeOnSelect,
  closeBeforeSelect,
}: ActionMenuOptionProps) => (
  <MenuOption
    onSelect={onSelect}
    closeOnSelect={closeOnSelect}
    closeBeforeSelect={closeBeforeSelect}
  >
    <ActionMenuContent icon={icon} label={label} color={color} />
  </MenuOption>
)

export const ActionSheetItem = ({ icon, label, color, onPress }: ActionSheetItemProps) => (
  <TouchableBox
    onPress={onPress}
    row
    alignItems="center"
    justifyContent="space-between"
    padding={20}
    borderBottomWidth={1}
    borderColor="border"
    overflow="hidden"
  >
    <ActionMenuContent icon={icon} label={label} color={color} />
  </TouchableBox>
)
