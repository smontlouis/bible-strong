import { useTheme } from '@emotion/react'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetProps,
} from '@gorhom/bottom-sheet'
import React from 'react'
import { useWindowDimensions } from 'react-native'

export const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
)

export const useBottomSheetStyles = () => {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const containerWidth = 400
  return {
    style: {
      marginLeft: width / 2 - containerWidth / 2,
      maxWidth: containerWidth,
      width: '100%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: theme.colors.reverse,
      shadowColor: theme.colors.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    } as BottomSheetProps['style'],
    handleIndicatorStyle: {
      backgroundColor: theme.colors.default,
      opacity: 0.5,
    } as BottomSheetProps['handleIndicatorStyle'],
    backgroundStyle: {
      backgroundColor: theme.colors.reverse,
    } as BottomSheetProps['backgroundStyle'],
  }
}
