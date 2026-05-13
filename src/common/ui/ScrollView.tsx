import styled from '@emotion/native'
import React from 'react'
import { ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native'

import { useTheme } from '@emotion/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'

type StyledScrollViewProps = {
  orientation: Orientation
  backgroundColor?: string
}

const ScrollView = styled.ScrollView<StyledScrollViewProps>(
  ({ theme, orientation, backgroundColor }) => ({
    backgroundColor: backgroundColor
      ? theme.colors[backgroundColor as keyof typeof theme.colors] || backgroundColor
      : theme.colors.reverse,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxWidth: orientation.maxWidth,
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',

    ...(orientation.tablet && {
      marginTop: 20,
      marginBottom: 50,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    }),
  })
)

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
}

const AppScrollView = ({ children, contentContainerStyle = {}, ...props }: AppScrollViewProps) => {
  const orientation = useDeviceOrientation()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      {...props}
      orientation={orientation}
      contentContainerStyle={{
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
