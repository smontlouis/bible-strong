import styled from '@emotion/native'
import React, { useMemo } from 'react'
import {
  FlatList as RNFlatList,
  FlatListProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'

type StyledFlatListProps = {
  orientation: Orientation
  bg?: string
}

const FlatList = styled.FlatList<StyledFlatListProps>(({ theme, orientation, bg }) => ({
  paddingBottom: 30,
  backgroundColor: bg ? theme.colors[bg as keyof typeof theme.colors] || bg : theme.colors.reverse,
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
  const style = useMemo(
    () => ({
      paddingBottom: 10 + insets.bottom,
      ...StyleSheet.flatten(contentContainerStyle),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
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
