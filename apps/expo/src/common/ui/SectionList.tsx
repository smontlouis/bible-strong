import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
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
import { useTheme as useAppTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from './PageContent'

const SectionList = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.SectionList>,
    keyof { theme?: Theme; orientation: Orientation } | 'theme'
  > &
    Omit<{ theme?: Theme; orientation: Orientation }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { orientation } = props
  const resolvedClassName = twMerge(
    'pb-[30px] rounded-tl-[30px] rounded-tr-[30px] w-[100%] ml-auto mr-auto',
    className
  )
  return (
    <NativeUI.SectionList
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            backgroundColor: theme?.colors.reverse,
            ...(orientation.tablet && {
              marginTop: 20,
              marginBottom: 50,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.SectionList>['style']
      }
    />
  )
}

const AnimatedSectionList = <T, S = unknown>({
  contentContainerStyle,
  ref,
  ...props
}: SectionListProps<T, S> & {
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
