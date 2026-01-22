import { useSetAtom } from 'jotai/react'

import Box from '~common/ui/Box'
import ColorCircleGrid from '~common/ColorCircleGrid'
import { useColorItems } from '~helpers/useHighlightColors'
import { colorPickerModalAtom } from '~state/app'

interface AnnotationColorSelectorProps {
  onSelectColor: (colorKey: string) => void
  selectedColor?: string
  ctx: { menuActions: { closeMenu: () => void } }
}

const AnnotationColorSelector = ({
  onSelectColor,
  selectedColor,
  ctx,
}: AnnotationColorSelectorProps) => {
  const colorItems = useColorItems()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)

  const handleColorPress = (colorKey: string) => {
    onSelectColor(colorKey)
    ctx.menuActions.closeMenu()
  }

  const handleAddPress = () => {
    ctx.menuActions.closeMenu()
    setColorPickerModal({
      selectedColor,
      onSelectColor: (colorId: string) => {
        onSelectColor(colorId)
      },
    })
  }

  return (
    <Box width={182} overflow="visible">
      <ColorCircleGrid
        colors={colorItems}
        selectedColor={selectedColor}
        onSelect={handleColorPress}
        showAddButton
        onAddPress={handleAddPress}
        layout="grid"
        circleSize={30}
      />
    </Box>
  )
}

export default AnnotationColorSelector
