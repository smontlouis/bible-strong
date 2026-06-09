import { Icon } from '@expo/ui'
import {
  MenuView as ExpoMenuView,
  type MenuAction,
  type MenuComponentProps,
  type MenuComponentRef,
} from '@expo/ui/community/menu'
import React from 'react'

export type { MenuAction, MenuComponentProps, MenuComponentRef }

const menuIcons = {
  'arrow.down': Icon.select({
    ios: 'arrow.down',
    android: require('@expo/material-symbols/arrow_downward.xml'),
  }),
  'arrow.down.right.and.arrow.up.left': Icon.select({
    ios: 'arrow.down.right.and.arrow.up.left',
    android: require('@expo/material-symbols/close_fullscreen.xml'),
  }),
  'arrow.right': Icon.select({
    ios: 'arrow.right',
    android: require('@expo/material-symbols/arrow_forward.xml'),
  }),
  'arrow.up.left.and.arrow.down.right': Icon.select({
    ios: 'arrow.up.left.and.arrow.down.right',
    android: require('@expo/material-symbols/open_in_full.xml'),
  }),
  'arrow.triangle.2.circlepath': Icon.select({
    ios: 'arrow.triangle.2.circlepath',
    android: require('@expo/material-symbols/compare_arrows.xml'),
  }),
  'arrow.triangle.merge': Icon.select({
    ios: 'arrow.triangle.merge',
    android: require('@expo/material-symbols/merge.xml'),
  }),
  'arrow.up.forward.square': Icon.select({
    ios: 'arrow.up.forward.square',
    android: require('@expo/material-symbols/open_in_new.xml'),
  }),
  book: Icon.select({
    ios: 'book',
    android: require('@expo/material-symbols/book.xml'),
  }),
  bookmark: Icon.select({
    ios: 'bookmark',
    android: require('@expo/material-symbols/bookmark.xml'),
  }),
  'bubble.left.and.bubble.right': Icon.select({
    ios: 'bubble.left.and.bubble.right',
    android: require('@expo/material-symbols/forum.xml'),
  }),
  checkmark: Icon.select({
    ios: 'checkmark',
    android: require('@expo/material-symbols/check.xml'),
  }),
  'checkmark.square': Icon.select({
    ios: 'checkmark.square',
    android: require('@expo/material-symbols/check_box.xml'),
  }),
  'clock.arrow.circlepath': Icon.select({
    ios: 'clock.arrow.circlepath',
    android: require('@expo/material-symbols/history.xml'),
  }),
  gearshape: Icon.select({
    ios: 'gearshape',
    android: require('@expo/material-symbols/settings.xml'),
  }),
  globe: Icon.select({
    ios: 'globe',
    android: require('@expo/material-symbols/globe.xml'),
  }),
  'info.circle': Icon.select({
    ios: 'info.circle',
    android: require('@expo/material-symbols/info.xml'),
  }),
  'list.bullet': Icon.select({
    ios: 'list.bullet',
    android: require('@expo/material-symbols/list.xml'),
  }),
  magnifyingglass: Icon.select({
    ios: 'magnifyingglass',
    android: require('@expo/material-symbols/search.xml'),
  }),
  number: Icon.select({
    ios: 'number',
    android: require('@expo/material-symbols/numbers.xml'),
  }),
  pencil: Icon.select({
    ios: 'pencil',
    android: require('@expo/material-symbols/edit.xml'),
  }),
  'plus.circle': Icon.select({
    ios: 'plus.circle',
    android: require('@expo/material-symbols/add_circle.xml'),
  }),
  'plus.square': Icon.select({
    ios: 'plus.square',
    android: require('@expo/material-symbols/add_box.xml'),
  }),
  'point.3.connected.trianglepath.dotted': Icon.select({
    ios: 'point.3.connected.trianglepath.dotted',
    android: require('@expo/material-symbols/hub.xml'),
  }),
  'rectangle.portrait.and.arrow.right': Icon.select({
    ios: 'rectangle.portrait.and.arrow.right',
    android: require('@expo/material-symbols/exit_to_app.xml'),
  }),
  'rectangle.split.2x1': Icon.select({
    ios: 'rectangle.split.2x1',
    android: require('@expo/material-symbols/splitscreen.xml'),
  }),
  'square.and.arrow.up': Icon.select({
    ios: 'square.and.arrow.up',
    android: require('@expo/material-symbols/share.xml'),
  }),
  'square.stack.3d.up': Icon.select({
    ios: 'square.stack.3d.up',
    android: require('@expo/material-symbols/layers.xml'),
  }),
  tag: Icon.select({
    ios: 'tag',
    android: require('@expo/material-symbols/sell.xml'),
  }),
  textformat: Icon.select({
    ios: 'textformat',
    android: require('@expo/material-symbols/text_fields.xml'),
  }),
  trash: Icon.select({
    ios: 'trash',
    android: require('@expo/material-symbols/delete.xml'),
  }),
  xmark: Icon.select({
    ios: 'xmark',
    android: require('@expo/material-symbols/close.xml'),
  }),
  'xmark.circle': Icon.select({
    ios: 'xmark.circle',
    android: require('@expo/material-symbols/cancel.xml'),
  }),
} satisfies Partial<Record<string, MenuAction['image']>>

const getMenuImage = (image: MenuAction['image']): MenuAction['image'] => {
  if (typeof image !== 'string') return image

  return menuIcons[image as keyof typeof menuIcons] ?? image
}

const withAndroidMenuIcons = (actions: MenuAction[]): MenuAction[] =>
  actions.map(action => ({
    ...action,
    image: getMenuImage(action.image),
    subactions: action.subactions ? withAndroidMenuIcons(action.subactions) : undefined,
  }))

export const MenuView = React.forwardRef<MenuComponentRef, MenuComponentProps>(
  ({ actions, ...props }, ref) => (
    <ExpoMenuView {...props} ref={ref} actions={withAndroidMenuIcons(actions)} />
  )
)

MenuView.displayName = 'MenuView'
