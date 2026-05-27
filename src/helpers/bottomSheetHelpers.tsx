import { useTheme } from '@emotion/react'
import { BottomSheetBackdrop, BottomSheetProps } from '@gorhom/bottom-sheet'
import { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types'
import { useId } from 'react'
import { useWindowDimensions } from 'react-native'

export const renderBackdrop = (props: BottomSheetDefaultBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
)

export const onAnimateModalClose =
  (onClose?: () => void) => (fromIndex: number, toIndex: number) => {
    if (toIndex === -1) onClose?.()
  }

export const useBottomSheetStyles = () => {
  const theme = useTheme()
  const id = useId()
  const { width } = useWindowDimensions()

  const containerWidth = 500
  return {
    // Reset key to force re-render on orientation change
    key: `modal-${id}`,
    style: {
      marginLeft: width > containerWidth ? width / 2 - containerWidth / 2 : 0,
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
