import styled from '@emotion/native'
import React, { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

// @ts-ignore
const FlatList = styled.FlatList(({ theme, orientation, bg }: any) => ({
  paddingBottom: 30,
  backgroundColor: theme.colors[bg] || theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  maxWidth: orientation.maxWidth,
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',

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

const AnimatedFlatList = React.forwardRef(({ contentContainerStyle, ...props }: any, ref: any) => {
  const insets = useSafeAreaInsets()
  const orientation = useDeviceOrientation()
  const style = useMemo(
    () => ({
      paddingBottom: 10 + insets.bottom,
      ...contentContainerStyle,
    }),
    []
  )
  return (
    // @ts-ignore
    <FlatList orientation={orientation} contentContainerStyle={style} ref={ref} {...props} />
  )
})

export default AnimatedFlatList
