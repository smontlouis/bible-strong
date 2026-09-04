import styled from '@emotion/native'
import React, { useMemo } from 'react'
import {
  SectionList as RNSectionList,
  SectionListProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation, { Orientation } from '~helpers/useDeviceOrientation'
import { Theme } from '~themes'

const SectionList = styled.SectionList(
  ({ theme, orientation }: { theme?: Theme; orientation: Orientation }) => ({
    paddingBottom: 30,
    backgroundColor: theme?.colors.reverse,
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
  })
)

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
  const style = useMemo(
    () => ({
      paddingBottom: 10 + insets.bottom,
      ...StyleSheet.flatten(contentContainerStyle),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
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
