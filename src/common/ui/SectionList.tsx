import styled from '@emotion/native'
import React, { useMemo } from 'react'
import { SectionListProps, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useDeviceOrientation from '~helpers/useDeviceOrientation'
import { Theme } from '~themes'

const SectionList = styled.SectionList(
  ({
    theme,
    orientation,
  }: {
    theme: Theme
    orientation: {
      portrait: boolean
      landscape: boolean
      tablet: boolean
      maxWidth: number
    }
  }) => ({
    paddingBottom: 30,
    backgroundColor: theme.colors.reverse,
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

export default React.forwardRef(
  ({ contentContainerStyle, ...props }: SectionListProps<any>, ref) => {
    const orientation = useDeviceOrientation()
    const insets = useSafeAreaInsets()
    const style = useMemo(
      () => ({
        paddingBottom: 10 + insets.bottom,
        ...contentContainerStyle,
      }),
      []
    )
    return (
      <View style={{ flex: 1 }}>
        <SectionList
          orientation={orientation}
          contentContainerStyle={style}
          ref={ref}
          {...props}
        />
      </View>
    )
  }
)
