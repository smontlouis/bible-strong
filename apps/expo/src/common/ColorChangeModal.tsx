import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SheetView } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ColorCircleGrid from '~common/ColorCircleGrid'
import { useSheet } from '~helpers/useSheet'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorChangeModalAtom, colorPickerModalAtom } from '~state/app'

const ColorChangeModal = () => {
  const { t } = useTranslation()
  const item = useAtomValue(colorChangeModalAtom)
  const setColorChangeModal = useSetAtom(colorChangeModalAtom)
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const { ref, open, close } = useSheet()
  const insets = useSafeAreaInsets()

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
    <Sheet panelTitle={t('Changer la couleur')} ref={ref} onDismiss={handleModalClose}>
      <SheetView>
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
      </SheetView>
    </Sheet>
  )
}

export default ColorChangeModal
