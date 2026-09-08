import type { ComponentProps } from 'react'
import { Platform } from 'react-native'
import { ActionSheetItem } from '~common/ActionMenu'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'

export default function PanelAction({
  label,
  icon,
  destructive,
  disabled,
  nested,
  onPress,
}: {
  label: string
  icon?: ComponentProps<typeof FeatherIcon>['name']
  destructive?: boolean
  disabled?: boolean
  nested?: boolean
  onPress: () => void
}) {
  if (Platform.OS !== 'web' && icon && !disabled) {
    return (
      <ActionSheetItem
        icon={icon}
        label={label}
        color={destructive ? 'quart' : 'default'}
        onPress={onPress}
        nested={nested}
      />
    )
  }
  return (
    <TouchableBox
      className={
        Platform.OS === 'web'
          ? 'w-full flex-row items-center gap-3 p-3 rounded-lg'
          : 'w-full flex-row items-center p-[20px] border-b-[1px] border-border'
      }
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={{ opacity: disabled ? 0.5 : 1 }}
      onPress={onPress}
    >
      {icon && <FeatherIcon name={icon} size={17} color={destructive ? 'quart' : 'default'} />}
      <Text
        className={`flex-1 ${Platform.OS === 'web' ? 'text-[14px]' : 'text-[16px]'} ${destructive ? 'text-quart' : 'text-default'}`}
      >
        {label}
      </Text>
      {nested && (
        <FeatherIcon name="chevron-right" size={Platform.OS === 'web' ? 15 : 20} color="tertiary" />
      )}
    </TouchableBox>
  )
}
