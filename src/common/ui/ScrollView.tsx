import styled from '@emotion/native'
import React from 'react'

import { useTheme } from '@emotion/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

// @ts-ignore
const ScrollView = styled.ScrollView(({ theme, orientation, backgroundColor }: any) => ({
  backgroundColor: theme.colors[backgroundColor] || theme.colors.reverse,
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
}))

const fadeIn = {
  from: {
    translateY: 10,
    opacity: 0,
  },
  to: {
    translateY: 0,
    opacity: 1,
  },
}

type HomeScrollViewProps = {
  children: any
  showsVerticalScrollIndicator: boolean
  contentContainerStyle?: any
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
    // @ts-ignore
    <ScrollView
      {...props}
      orientation={orientation}
      backgroundColor="lightGrey"
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={{
        backgroundColor: theme.colors.lightGrey,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        ...contentContainerStyle,
      }}
    >
      {children}
    </ScrollView>
  )
}

export default ({ children, contentContainerStyle = {}, ...props }: any) => {
  const orientation = useDeviceOrientation()
  return (
    // @ts-ignore
    <ScrollView
      {...props}
      orientation={orientation}
      contentContainerStyle={{
        paddingTop: 20,
        paddingBottom: 10 + useSafeAreaInsets().bottom,
        ...contentContainerStyle,
      }}
    >
      {children}
    </ScrollView>
  )
}
