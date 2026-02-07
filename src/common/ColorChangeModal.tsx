import { useEffect } from 'react'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ColorCircleGrid from '~common/ColorCircleGrid'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorChangeModalAtom, colorPickerModalAtom } from '~state/app'

const ColorChangeModal = () => {
  const item = useAtomValue(colorChangeModalAtom)
  const setColorChangeModal = useSetAtom(colorChangeModalAtom)
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const { ref, open, close } = useBottomSheetModal()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const colorItems = useColorItems({ includeTypes: true })

  // Auto-open when atom changes
  useEffect(() => {
    if (item) {
      open()
    }
  }, [item, open])

  const handleColorSelect = (colorId: string) => {
    if (item && item.onSelectColor) {
      item.onSelectColor(colorId)
      close()
      setColorChangeModal(false)
    }
  }

  const handleOpenColorPicker = () => {
    close()
    if (item) {
      setColorPickerModal({
        selectedColor: item.selectedColor,
        onSelectColor: item.onSelectColor,
      })
    }
    setColorChangeModal(false)
  }

  const handleModalClose = () => {
    setColorChangeModal(false)
  }

  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      activeOffsetY={[-20, 20]}
      onDismiss={handleModalClose}
      key={key}
      {...bottomSheetStyles}
    >
      <ColorCircleGrid
        colors={colorItems}
        selectedColor={item ? item.selectedColor : undefined}
        onSelect={handleColorSelect}
        showAddButton
        onAddPress={handleOpenColorPicker}
        layout="scroll"
        scrollPadding={{ vertical: 10 }}
        itemHeight={60 + insets.bottom}
      />
    </BottomSheetModal>
  )
}

export default ColorChangeModal
