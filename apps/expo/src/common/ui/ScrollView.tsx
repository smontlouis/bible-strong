import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme, useTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from './PageContent'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'

type StyledScrollViewProps = {
  orientation: Orientation
  backgroundColor?: string
}

const ScrollView = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.ScrollView>,
    keyof StyledScrollViewProps | 'theme'
  > &
    Omit<StyledScrollViewProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { orientation, backgroundColor } = props
  const classStyles = useResolveClassNames(twMerge('ml-auto mr-auto w-[100%]', className))
  return (
    <NativeUI.ScrollView
      {...props}
      style={
        [
          classStyles,
          {
            backgroundColor: backgroundColor
              ? theme.colors[backgroundColor as keyof typeof theme.colors] || backgroundColor
              : theme.colors.reverse,
            ...(orientation.tablet && {
              marginTop: 20,
              marginBottom: 50,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.ScrollView>['style']
      }
    />
  )
}

type HomeScrollViewProps = ScrollViewProps & {
  children: React.ReactNode
  showsVerticalScrollIndicator: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
}

export const HomeScrollView = ({
  children,
  showsVerticalScrollIndicator,
  contentContainerStyle,
  ...props
}: HomeScrollViewProps) => {
  const orientation = useDeviceOrientation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      {...props}
      orientation={orientation}
      backgroundColor="lightGrey"
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={{
        ...(!props.horizontal && pageContentStyle),
        backgroundColor: theme.colors.lightGrey,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        ...StyleSheet.flatten(contentContainerStyle),
      }}
    >
      {children}
    </ScrollView>
  )
}

type AppScrollViewProps = ScrollViewProps & {
  children: React.ReactNode
  backgroundColor?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  ref?: React.Ref<React.ComponentRef<typeof ScrollView>>
}

const AppScrollView = ({
  children,
  contentContainerStyle = {},
  ref,
  ...props
}: AppScrollViewProps) => {
  const orientation = useDeviceOrientation()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      ref={ref}
      {...props}
      orientation={orientation}
      contentContainerStyle={{
        ...(!props.horizontal && pageContentStyle),
        paddingTop: 20,
        paddingBottom: 10 + insets.bottom,
        ...StyleSheet.flatten(contentContainerStyle),
      }}
    >
      {children}
    </ScrollView>
  )
}

export default AppScrollView
