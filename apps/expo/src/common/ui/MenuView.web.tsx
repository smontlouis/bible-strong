import { useTabCommands } from '~common/useTabCommands'
import type { MenuAction, MenuComponentProps, MenuComponentRef } from '@expo/ui/community/menu'
import Feather from '@expo/vector-icons/Feather'
import { Dropdown } from '@heroui/react/dropdown'
import { Header } from '@heroui/react/header'
import { Label } from '@heroui/react/label'
import React, { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { webFontFamily } from '~helpers/webFontFamily'
import { useTheme } from '~themes/ThemeProvider'
import './MenuView.web.css'

export type { MenuAction, MenuComponentProps, MenuComponentRef }
export type AccessibleMenuComponentProps = MenuComponentProps & {
  tabActions?: boolean
  accessibilityLabel?: string
  renderActionIcon?: (action: MenuAction) => React.ReactNode
}

const icons: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  gearshape: 'settings',
  'slider.horizontal.3': 'sliders',
  'rectangle.split.2x1': 'columns',
  'clock.arrow.circlepath': 'clock',
  bookmark: 'bookmark',
  'square.and.arrow.up': 'share',
  'plus.square': 'plus-square',
  'plus.circle': 'plus-circle',
  'arrow.up.forward.square': 'external-link',
  'square.stack.3d.up': 'layers',
  trash: 'trash-2',
  pencil: 'edit-2',
  tag: 'tag',
  book: 'book',
  globe: 'globe',
  'info.circle': 'info',
  'list.bullet': 'list',
  magnifyingglass: 'search',
  number: 'hash',
  textformat: 'type',
  'checkmark.square': 'check-square',
  checkmark: 'check',
  xmark: 'x',
  'xmark.circle': 'x-circle',
  'arrow.triangle.2.circlepath': 'repeat',
  'arrow.triangle.merge': 'git-merge',
  'arrow.up.left.and.arrow.down.right': 'maximize-2',
  'arrow.down.right.and.arrow.up.left': 'minimize-2',
  'arrow.right': 'arrow-right',
  'arrow.down': 'arrow-down',
  'bubble.left.and.bubble.right': 'message-circle',
  'point.3.connected.trianglepath.dotted': 'share-2',
  'rectangle.portrait.and.arrow.right': 'log-out',
}

type MenuStyle = CSSProperties & Record<`--bs-menu-${string}`, string>

function visibleActions(actions: MenuAction[]): MenuAction[] {
  return actions
    .filter(action => !action.attributes?.hidden)
    .flatMap(action => {
      if (!action.subactions) return [action]
      const subactions = visibleActions(action.subactions)
      return subactions.length ? [{ ...action, subactions }] : []
    })
}

function menuSelection(actions: MenuAction[], path = 'menu') {
  const selectedKeys: string[] = []
  let hasState = false
  actions.forEach((action, index) => {
    const key = `${path}-${index}`
    if (action.subactions && action.displayInline) {
      const section = menuSelection(action.subactions, key)
      selectedKeys.push(...section.selectedKeys)
      hasState ||= section.selectionMode === 'multiple'
    } else if (!action.subactions && action.state !== undefined) {
      hasState = true
      if (action.state === 'on') selectedKeys.push(key)
    }
  })
  return { selectionMode: hasState ? ('multiple' as const) : ('none' as const), selectedKeys }
}

function renderActions(
  actions: MenuAction[],
  select: (action: MenuAction) => void,
  menuStyle: MenuStyle,
  path = 'menu',
  parentDisabled = false,
  insideSection = false,
  renderActionIcon?: (action: MenuAction) => React.ReactNode
): React.ReactNode[] {
  return actions.map((action, index) => {
    const key = `${path}-${index}`
    const disabled = parentDisabled || !!action.attributes?.disabled
    const icon = typeof action.image === 'string' ? icons[action.image] : undefined
    const customIcon = renderActionIcon?.(action)
    const content = (
      <>
        <span className="bs-menu-icon" aria-hidden="true">
          {action.state === 'on' ? (
            '✓'
          ) : customIcon ? (
            customIcon
          ) : icon ? (
            <Feather
              name={icon}
              size={16}
              color={typeof action.imageColor === 'string' ? action.imageColor : 'currentColor'}
            />
          ) : null}
        </span>
        <Label className="bs-menu-label">{action.title}</Label>
      </>
    )

    if (action.subactions && action.displayInline) {
      return (
        <Dropdown.Section
          key={key}
          className="bs-menu-section"
          aria-label={action.title}
          {...menuSelection(action.subactions, key)}
        >
          {action.title ? <Header className="bs-menu-heading">{action.title}</Header> : null}
          {renderActions(
            action.subactions,
            select,
            menuStyle,
            key,
            disabled,
            true,
            renderActionIcon
          )}
        </Dropdown.Section>
      )
    }

    if (action.subactions) {
      return (
        <Dropdown.SubmenuTrigger key={key}>
          <Dropdown.Item
            id={key}
            textValue={action.title}
            isDisabled={disabled}
            className="bs-menu-item"
          >
            {content}
            <Dropdown.SubmenuIndicator className="bs-menu-chevron" />
          </Dropdown.Item>
          <Dropdown.Popover
            className="bs-menu-popover"
            style={menuStyle}
            placement="right top"
            offset={4}
          >
            <Dropdown.Menu className="bs-menu-list" aria-label={action.title}>
              {renderActions(
                action.subactions,
                select,
                menuStyle,
                key,
                disabled,
                false,
                renderActionIcon
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.SubmenuTrigger>
      )
    }

    const item = (
      <Dropdown.Item
        key={key}
        id={key}
        textValue={action.title}
        className="bs-menu-item"
        isDisabled={disabled}
        variant={action.attributes?.destructive ? 'danger' : undefined}
        data-checked={action.state === 'on' || undefined}
        data-destructive={action.attributes?.destructive || undefined}
        style={typeof action.titleColor === 'string' ? { color: action.titleColor } : undefined}
        onAction={() => {
          if (!disabled) select(action)
        }}
      >
        {content}
      </Dropdown.Item>
    )
    if (action.state !== undefined && !insideSection) {
      return (
        <Dropdown.Section
          key={key}
          className="bs-menu-choice-group"
          aria-label={action.title}
          selectionMode="multiple"
          selectedKeys={action.state === 'on' ? [key] : []}
        >
          {item}
        </Dropdown.Section>
      )
    }
    return item
  })
}

/** Web implementation of the shared native menu contract. */
export const MenuView = forwardRef<MenuComponentRef, AccessibleMenuComponentProps>(
  (
    {
      actions,
      tabActions,
      children,
      title,
      accessibilityLabel,
      renderActionIcon,
      testID,
      style,
      shouldOpenOnLongPress,
      onOpenMenu,
      onCloseMenu,
      onPressAction,
    },
    ref
  ) => {
    const theme = useTheme()
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)
    const openRef = useRef(false)
    const availableActions = visibleActions(actions)
    const label = accessibilityLabel || title || t('accessibility.options')
    const changeOpen = (next: boolean) => {
      if (next && !availableActions.length) return
      if (openRef.current === next) return
      openRef.current = next
      setIsOpen(next)
      if (next) onOpenMenu?.()
      else onCloseMenu?.()
    }
    useImperativeHandle(ref, () => ({ show: () => changeOpen(true) }))

    // Popovers portal outside the Uniwind scope, so carry the current palette explicitly.
    const menuStyle: MenuStyle = {
      '--bs-menu-background': theme.colors.reverse,
      '--bs-menu-foreground': theme.colors.default,
      '--bs-menu-hover': theme.colors.lightGrey,
      '--bs-menu-border': theme.colors.border,
      '--bs-menu-accent': theme.colors.primary,
      '--bs-menu-muted': theme.colors.grey,
      '--bs-menu-danger': theme.colors.quart,
      fontFamily: webFontFamily(theme.fontFamily.text),
    }
    const select = (action: MenuAction) => {
      changeOpen(false)
      onPressAction?.({ nativeEvent: { event: action.id ?? action.title } })
    }

    useTabCommands(tabActions ? actions : undefined, id => {
      onPressAction?.({ nativeEvent: { event: id } })
    })

    return (
      <View style={style}>
        <Dropdown
          isOpen={isOpen}
          onOpenChange={changeOpen}
          trigger={shouldOpenOnLongPress ? 'longPress' : 'press'}
        >
          <Dropdown.Trigger
            className="bs-menu-trigger"
            aria-label={label}
            data-testid={testID}
            isDisabled={!availableActions.length}
          >
            <span
              className="bs-menu-trigger-content"
              inert={!shouldOpenOnLongPress}
              aria-hidden={!shouldOpenOnLongPress}
            >
              {children}
            </span>
          </Dropdown.Trigger>
          <Dropdown.Popover
            className="bs-menu-popover"
            style={menuStyle}
            placement="bottom"
            offset={6}
          >
            <Dropdown.Menu className="bs-menu-list" aria-label={title || label}>
              {renderActions(
                availableActions,
                select,
                menuStyle,
                'menu',
                false,
                false,
                renderActionIcon
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </View>
    )
  }
)
MenuView.displayName = 'MenuView'
