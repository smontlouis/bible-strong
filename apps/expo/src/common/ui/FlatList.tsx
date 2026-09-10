import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import {
  FlatListProps,
  FlatList as RNFlatList,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { twMerge } from '~common/ui/classNames'

import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from './PageContent'

type StyledFlatListProps = {
  orientation: Orientation
  bg?: string
}

const FlatList = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.FlatList>,
    keyof StyledFlatListProps | 'theme'
  > &
    Omit<StyledFlatListProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { orientation, bg } = props
  const resolvedClassName = twMerge(
    'pb-[30px] rounded-tl-[30px] rounded-tr-[30px] w-[100%] ml-auto mr-auto',
    className
  )
  return (
    <NativeUI.FlatList
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            backgroundColor: bg
              ? theme.colors[bg as keyof typeof theme.colors] || bg
              : theme.colors.reverse,
            ...(orientation.tablet && {
              marginTop: 20,
              marginBottom: 50,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.FlatList>['style']
      }
    />
  )
}

type AnimatedFlatListProps<T> = FlatListProps<T> & {
  bg?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  ref?: React.Ref<RNFlatList<T>>
}

const AnimatedFlatList = <T,>({
  bg,
  contentContainerStyle,
  ref,
  ...props
}: AnimatedFlatListProps<T>) => {
  const insets = useSafeAreaInsets()
  const orientation = useDeviceOrientation()
  const style = {
    ...pageContentStyle,
    paddingBottom: 10 + insets.bottom,
    ...StyleSheet.flatten(contentContainerStyle),
  }

  return (
    <FlatList
      orientation={orientation}
      bg={bg}
      contentContainerStyle={style}
      ref={ref as unknown as React.Ref<React.ComponentRef<typeof FlatList>>}
      {...(props as unknown as FlatListProps<unknown>)}
    />
  )
}

export default AnimatedFlatList
