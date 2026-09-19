import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import type { CSSProperties } from 'react'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'

export type WidgetSelectItem = { id: string; label: string }

export default function WidgetSelect({
  label,
  value,
  items,
  className = '',
  popoverMinWidth = 112,
  onChange,
}: {
  label: string
  value: string
  items: WidgetSelectItem[]
  className?: string
  popoverMinWidth?: number
  onChange: (value: string) => void
}) {
  const { colors, fontFamily } = useTheme()
  const popoverStyle = {
    '--bs-version-select-background': colors.reverse,
    '--bs-version-select-foreground': colors.default,
    '--bs-version-select-border': colors.border,
    '--bs-version-select-hover': colors.lightGrey,
    '--bs-version-select-accent': colors.primary,
    backgroundColor: colors.reverse,
    color: colors.default,
    borderColor: colors.border,
    fontFamily: resolveFontFamily(fontFamily.text),
    maxHeight: 320,
    minWidth: popoverMinWidth,
    overflowY: 'auto',
    zIndex: 1600,
  } as CSSProperties
  return (
    <Select
      aria-label={label}
      className={`bs-widget-version-select ${className}`.trim()}
      selectedKey={value}
      onSelectionChange={key => {
        if (key != null) onChange(String(key))
      }}
    >
      <Select.Trigger className="bs-widget-version-select-trigger">
        <Select.Value className="bs-widget-version-select-value">
          {({ selectedText }) => selectedText}
        </Select.Value>
        <Select.Indicator className="bs-widget-version-select-indicator" />
      </Select.Trigger>
      <Select.Popover
        className="bs-widget-version-select-popover"
        placement="bottom end"
        style={popoverStyle}
      >
        <ListBox
          items={items}
          className="bs-widget-version-select-list"
          style={{ maxHeight: 316, overflowY: 'auto' }}
        >
          {item => (
            <ListBox.Item
              id={item.id}
              textValue={item.label}
              className="bs-widget-version-select-item"
            >
              <span>{item.label}</span>
              <ListBox.ItemIndicator className="bs-widget-version-select-check">
                {({ isSelected }) => (isSelected ? '✓' : null)}
              </ListBox.ItemIndicator>
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
