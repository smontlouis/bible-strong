import React, { ComponentProps, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type {
  MenuAction,
  MenuComponentProps,
  MenuComponentRef,
  NativeActionEvent,
} from '@expo/ui/community/menu'

import { Sheet, SheetHeader, SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

export type { MenuAction, MenuComponentProps, MenuComponentRef }

type FeatherIconName = ComponentProps<typeof FeatherIcon>['name']

type MenuLevel = {
  title?: string
  actions: MenuAction[]
}

const iconMap = {
  'arrow.down': 'arrow-down',
  'arrow.down.right.and.arrow.up.left': 'minimize-2',
  'arrow.right': 'arrow-right',
  'arrow.triangle.2.circlepath': 'repeat',
  'arrow.triangle.merge': 'git-merge',
  'arrow.up.forward.square': 'external-link',
  'arrow.up.left.and.arrow.down.right': 'maximize-2',
  book: 'book-open',
  bookmark: 'bookmark',
  'bubble.left.and.bubble.right': 'message-circle',
  checkmark: 'check',
  'checkmark.square': 'check-square',
  'clock.arrow.circlepath': 'clock',
  gearshape: 'settings',
  globe: 'globe',
  'info.circle': 'info',
  'list.bullet': 'list',
  magnifyingglass: 'search',
  number: 'hash',
  pencil: 'edit-2',
  'plus.circle': 'plus-circle',
  'plus.square': 'plus-square',
  'point.3.connected.trianglepath.dotted': 'git-merge',
  'rectangle.portrait.and.arrow.right': 'log-out',
  'rectangle.split.2x1': 'columns',
  'square.and.arrow.up': 'share',
  'square.grid.2x2': 'grid',
  'square.stack.3d.up': 'layers',
  tag: 'tag',
  textformat: 'type',
  trash: 'trash-2',
  xmark: 'x',
  'xmark.circle': 'x-circle',
} satisfies Partial<Record<string, FeatherIconName>>

const getActionId = (action: MenuAction) => action.id ?? action.title

const getActionIcon = (action: MenuAction): FeatherIconName => {
  if (typeof action.image !== 'string') return 'more-horizontal'

  return iconMap[action.image as keyof typeof iconMap] ?? 'more-horizontal'
}

const getVisibleActions = (actions: MenuAction[]): MenuAction[] =>
  actions.flatMap(action => {
    if (action.attributes?.hidden) return []
    if (action.displayInline && action.subactions?.length) {
      return getVisibleActions(action.subactions)
    }
    return [action]
  })

const makeEvent = (action: MenuAction): NativeActionEvent => ({
  nativeEvent: { event: getActionId(action) },
})

export const MenuView = forwardRef<MenuComponentRef, MenuComponentProps>(
  (
    {
      actions,
      children,
      onCloseMenu,
      onOpenMenu,
      onPressAction,
      shouldOpenOnLongPress,
      style,
      testID,
    },
    ref
  ) => {
    const sheetRef = useRef<SheetRef>(null)
    const [levels, setLevels] = useState<MenuLevel[]>([])

    const currentLevel = levels[levels.length - 1]
    const currentActions = getVisibleActions(currentLevel?.actions ?? actions)
    const canGoBack = levels.length > 0

    const openMenu = () => {
      setLevels([])
      sheetRef.current?.present()
      onOpenMenu?.()
    }

    const handleDismiss = () => {
      setLevels([])
      onCloseMenu?.()
    }

    const handleBackPress = () => {
      setLevels(prev => prev.slice(0, -1))
    }

    const handleActionPress = (action: MenuAction) => {
      if (action.attributes?.disabled) return

      if (action.subactions?.length) {
        setLevels(prev => [...prev, { title: action.title, actions: action.subactions ?? [] }])
        return
      }

      onPressAction?.(makeEvent(action))
    }

    useImperativeHandle(ref, () => ({ show: openMenu }))

    return (
      <>
        <TouchableBox
          testID={testID}
          style={style}
          activeOpacity={0.7}
          onPress={shouldOpenOnLongPress ? undefined : openMenu}
          onLongPress={shouldOpenOnLongPress ? openMenu : undefined}
        >
          {children}
        </TouchableBox>

        <Sheet
          ref={sheetRef}
          snapPoints={currentActions.length > 6 ? [1] : ['auto']}
          onDismiss={handleDismiss}
          header={
            <SheetHeader
              title={currentLevel?.title}
              centerTitle
              hasBackButton={canGoBack}
              onBackPress={handleBackPress}
            />
          }
        >
          {currentActions.map(action => {
            const disabled = action.attributes?.disabled
            const destructive = action.attributes?.destructive
            const color = destructive ? 'quart' : disabled ? 'tertiary' : 'default'

            return (
              <TouchableBox
                key={getActionId(action)}
                disabled={disabled}
                onPress={() => handleActionPress(action)}
                row
                alignItems="center"
                justifyContent="space-between"
                padding={20}
                borderBottomWidth={1}
                borderColor="border"
                overflow="hidden"
              >
                <Box row alignItems="center" flex={1}>
                  <Box width={20} alignItems="center">
                    <FeatherIcon name={getActionIcon(action)} size={15} color={color} />
                  </Box>
                  <Text marginLeft={10} color={color}>
                    {action.title}
                  </Text>
                </Box>
                {action.state === 'on' && <FeatherIcon name="check" size={16} color={color} />}
                {action.subactions?.length ? (
                  <FeatherIcon name="chevron-right" size={16} color={color} />
                ) : null}
              </TouchableBox>
            )
          })}
        </Sheet>
      </>
    )
  }
)

MenuView.displayName = 'MenuView'
