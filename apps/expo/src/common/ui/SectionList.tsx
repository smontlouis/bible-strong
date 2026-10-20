import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import {
  SectionList as RNSectionList,
  SectionListProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { twMerge } from '~common/ui/classNames'

import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'
import type { Theme as AppTheme } from '~themes'
import { Theme } from '~themes'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from './PageContent'

const SectionList = (
  componentProps: Omit<
    UIComponentProps<typeof RNSectionList>,
    keyof { theme?: Theme; orientation: Orientation; bg?: string } | 'theme'
  > &
    Omit<{ theme?: Theme; orientation: Orientation; bg?: string }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { orientation, bg } = props
  const resolvedClassName = twMerge('pb-[30px] w-[100%] ml-auto mr-auto', className)
  return (
    <RNSectionList
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            backgroundColor: resolveThemeColor(theme, bg) ?? theme?.colors.reverse,
            ...(orientation.tablet && {
              marginTop: 20,
              marginBottom: 50,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof RNSectionList>['style']
      }
    />
  )
}

const AnimatedSectionList = <T, S = unknown>({
  contentContainerStyle,
  ref,
  ...props
}: SectionListProps<T, S> & {
  /** Palette token or color of the list ground; the page ground by default. */
  bg?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  ref?: React.Ref<RNSectionList<T, S>>
}) => {
  const orientation = useDeviceOrientation()
  const insets = useSafeAreaInsets()
  const style = {
    ...pageContentStyle,
    paddingBottom: 10 + insets.bottom,
    ...StyleSheet.flatten(contentContainerStyle),
  }

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        orientation={orientation}
        contentContainerStyle={style}
        ref={ref as unknown as React.Ref<React.ComponentRef<typeof SectionList>>}
        {...(props as unknown as SectionListProps<unknown, unknown>)}
      />
    </View>
  )
}

export default AnimatedSectionList
