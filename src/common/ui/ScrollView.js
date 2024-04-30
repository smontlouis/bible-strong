import styled from '@emotion/native'
import React from 'react'

import { useTheme } from '@emotion/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

{
  /* <ScrollView
  {...props}
  orientation={orientation}
  contentContainerStyle={{
    paddingTop: 20,
    paddingBottom: 20,
    ...contentContainerStyle,
  }}
>
  <Box
    maxWidth={orientation.maxWidth}
    ml="auto"
    mr="auto"
    width="100%"
    backgroundColor={theme.colors[backgroundColor] || theme.colors.reverse}
    borderTopRightRadius={30}
    borderTopLeftRadius={30}
    {...(orientation.tablet && {
      marginTop: 20,
      marginBottom: 50,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    })}
  >
    {children}
  </Box>
</ScrollView> */
}

const ScrollView = styled.ScrollView(
  ({ theme, orientation, backgroundColor }) => ({
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
  })
)

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

export const HomeScrollView = ({
  children,
  contentContainerStyle,
  ...props
}) => {
  const orientation = useDeviceOrientation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      {...props}
      orientation={orientation}
      backgroundColor="lightGrey"
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

export default ({ children, contentContainerStyle = {}, ...props }) => {
  const orientation = useDeviceOrientation()
  return (
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
