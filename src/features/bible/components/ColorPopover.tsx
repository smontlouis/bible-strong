import { useState } from 'react'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import ColorPicker from '~common/ColorPicker'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { recentColorsAtom } from '~features/studies/atom'
import type { AnnotationType } from '../hooks/useAnnotationMode'

interface ColorPopoverProps {
  type: AnnotationType
  onApply: (color: string, type: AnnotationType) => void
  ctx: any
  currentColor?: string
}

const getDefaultColor = (type: AnnotationType): string => {
  switch (type) {
    case 'background':
      return '#FFEB3B'
    case 'underline':
      return '#2196F3'
    case 'circle':
      return '#ef8c22'
    default:
      return '#FFEB3B'
  }
}

export function ColorPopover({ type, onApply, ctx, currentColor }: ColorPopoverProps) {
  const { t } = useTranslation()
  const [recentColors, setRecentColors] = useAtom(recentColorsAtom)
  const [selectedColor, setSelectedColor] = useState(currentColor || getDefaultColor(type))

  const handleColorChange = (color: ColorFormatsObject) => {
    setSelectedColor(color.hex)
  }

  const addToRecentColors = (color: string) => {
    const newColors = [color, ...recentColors.filter(c => c !== color)].slice(0, 5)
    setRecentColors(newColors)
  }

  const handleConfirm = () => {
    onApply(selectedColor, type)
    addToRecentColors(selectedColor)
    ctx.menuActions.closeMenu()
  }

  const handleRecentColorPress = (color: string) => {
    onApply(color, type)
    addToRecentColors(color)
    ctx.menuActions.closeMenu()
  }

  return (
    <Box width={250}>
      <Box height={280}>
        <HStack justifyContent="space-around">
          {recentColors?.length > 0 &&
            recentColors.map(color => (
              <TouchableBox
                key={color}
                width={32}
                height={32}
                bg={color}
                borderRadius={8}
                borderWidth={3}
                borderColor="opacity5"
                onPress={() => handleRecentColorPress(color)}
              />
            ))}
        </HStack>
        <ColorPicker value={selectedColor} onChangeJS={handleColorChange} />
      </Box>
      <Button small onPress={handleConfirm}>
        {t('Valider')}
      </Button>
    </Box>
  )
}
