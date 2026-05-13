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

const AnimatedFlatList = ({ contentContainerStyle, ref, ...props }: any) => {
  const insets = useSafeAreaInsets()
  const orientation = useDeviceOrientation()
  const style = useMemo(
    () => ({
      paddingBottom: 10 + insets.bottom,
      ...contentContainerStyle,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  return (
    // @ts-ignore
    <FlatList orientation={orientation} contentContainerStyle={style} ref={ref} {...props} />
  )
}

export default AnimatedFlatList
