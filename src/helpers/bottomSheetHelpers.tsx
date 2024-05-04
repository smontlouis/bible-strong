import { useTheme } from '@emotion/react'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetProps,
} from '@gorhom/bottom-sheet'
import React from 'react'

export const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
)

export const useBottomSheetStyles = () => {
  const theme = useTheme()

  return {
    style: {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 400,
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
