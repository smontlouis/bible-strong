import { Image } from 'expo-image'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { useSelectionMenu } from '../selectionMenuContext'
import type { ActionItemProps } from '../types'
import ActionTile from './ActionTile'

const MENU_ICON_SIZE = 17

/** A tile in the selection sheet, a row with its key in the desktop selection menu. */
export default function ActionItem(props: ActionItemProps) {
  const menu = useSelectionMenu()
  const theme = useTheme()
  if (!menu) return <ActionTile {...props} />
  const { name, Icon, svgSource, tintColor, label, onPress, disabled, isActive, variant } = props
  const color = variant === 'emphasized' || isActive ? theme.colors.primary : undefined
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: !!isActive }}
      disabled={disabled}
      onPress={onPress}
      className="w-full flex-row items-center gap-3 px-[10px] h-[34px] rounded-lg"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {Icon ? (
        <Icon size={MENU_ICON_SIZE} />
      ) : svgSource ? (
        <Image
          source={svgSource}
          style={{ width: MENU_ICON_SIZE, height: MENU_ICON_SIZE }}
          tintColor={tintColor || theme.colors.primary}
          contentFit="contain"
        />
      ) : name ? (
        <FeatherIcon name={name} size={MENU_ICON_SIZE} color={color ?? tintColor ?? 'tertiary'} />
      ) : null}
      {/* The chevron follows the label: it says the action opens more, the key stays apart */}
      <Box className="flex-1 flex-row items-baseline gap-[6px] min-w-0">
        <Text
          className="flex-shrink text-[14px]"
          style={color ? { color, fontWeight: '600' } : undefined}
          numberOfLines={1}
        >
          {label}
        </Text>
        {props.nested && (
          // As tall as the label's capitals and sitting on its baseline, as a letter would: an
          // icon font glyph carries its own box and offset, which no nudge lines up everywhere.
          <svg
            aria-hidden
            width={6}
            height={10}
            viewBox="0 0 6 10"
            fill="none"
            style={{ flexShrink: 0, color: theme.colors.tertiary }}
          >
            <path
              d="M1 1l4 4-4 4"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Box>
      {!!props.shortcut && (
        <Text className="text-[12px] text-tertiary" style={{ fontVariant: ['tabular-nums'] }}>
          {props.shortcut}
        </Text>
      )}
    </TouchableBox>
  )
}
