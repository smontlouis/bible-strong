import { Switch } from '@heroui/react/switch'
import type { SwitchProps } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'

export default function InlineCommentarySwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: SwitchProps) {
  const { colors } = useTheme()
  return (
    <Switch
      aria-label={accessibilityLabel}
      isSelected={value}
      onChange={selected => {
        void onValueChange?.(selected)
      }}
      isDisabled={disabled}
    >
      <Switch.Content
        aria-label={accessibilityLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 32,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Switch.Control
          style={{
            position: 'relative',
            display: 'inline-block',
            width: 40,
            height: 24,
            borderRadius: 999,
            background: value ? colors.primary : colors.border,
            transition: 'background-color 160ms ease',
          }}
        >
          <Switch.Thumb
            style={{
              position: 'absolute',
              top: 2,
              left: 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transform: `translateX(${value ? 16 : 0}px)`,
              transition: 'transform 160ms ease',
            }}
          />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  )
}
