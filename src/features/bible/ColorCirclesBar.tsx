import { useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useSetAtom } from 'jotai/react'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import ColorCircleGrid from '~common/ColorCircleGrid'
import ColorEditModal from '~common/ColorEditModal'
import { useColorItems, useHighlightColors } from '~helpers/useHighlightColors'
import { DEFAULT_COLOR_KEYS, type DefaultColorKey } from '~helpers/constants'
import { EMPTY_OBJECT } from '~helpers/emptyReferences'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor, HighlightType } from '~redux/modules/user'
import {
  changeColor,
  setDefaultColorName,
  setDefaultColorType,
  updateCustomColor,
} from '~redux/modules/user'
import { colorPickerModalAtom } from '~state/app'

type EditingColor =
  | {
      type: 'default'
      colorKey: DefaultColorKey
      hex: string
      name?: string
      highlightType: HighlightType
    }
  | { type: 'custom'; color: CustomColor }

type Props = {
  selectedVerseHighlightColor: string | null
  addHighlight: (color: string) => void
  removeHighlight: () => void
  onClose?: () => void
}

const ColorCirclesBar = ({ selectedVerseHighlightColor, addHighlight, removeHighlight }: Props) => {
  const dispatch = useDispatch()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const modalRef = useRef<BottomSheetModal>(null)
  const [editingColor, setEditingColor] = useState<EditingColor | null>(null)

  const { colors, customHighlightColors, defaultColorTypes } = useHighlightColors()
  const colorItems = useColorItems({ includeTypes: true })

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_OBJECT,
    shallowEqual
  )

  const openEditModal = (colorInfo: EditingColor) => {
    setEditingColor(colorInfo)
    modalRef.current?.present()
  }

  const handleSaveColor = (hex: string, name: string | undefined, type: HighlightType) => {
    if (!editingColor) return

    if (editingColor.type === 'default') {
      dispatch(changeColor({ name: editingColor.colorKey, color: hex }))
      dispatch(setDefaultColorName(editingColor.colorKey, name))
      dispatch(setDefaultColorType(editingColor.colorKey, type))
    } else {
      dispatch(updateCustomColor(editingColor.color.id, hex, name, type))
    }
    setEditingColor(null)
  }

  const getModalProps = () => {
    if (!editingColor) {
      return { initialHex: '#ff7675', initialName: '', initialType: 'background' as HighlightType }
    }
    if (editingColor.type === 'default') {
      return {
        initialHex: editingColor.hex,
        initialName: editingColor.name ?? '',
        initialType: editingColor.highlightType,
      }
    }
    return {
      initialHex: editingColor.color.hex,
      initialName: editingColor.color.name ?? '',
      initialType: editingColor.color.type ?? ('background' as HighlightType),
    }
  }

  // Handle color press with toggle behavior
  const handleColorPress = (colorKey: string) => {
    if (selectedVerseHighlightColor === colorKey) {
      removeHighlight() // Toggle off
    } else {
      addHighlight(colorKey) // Apply new color
    }
  }

  // Handle long press to open edit modal
  const handleLongPress = (colorKey: string) => {
    if (DEFAULT_COLOR_KEYS.includes(colorKey as DefaultColorKey)) {
      const key = colorKey as DefaultColorKey
      openEditModal({
        type: 'default',
        colorKey: key,
        hex: colors[key],
        name: defaultColorNames[key],
        highlightType: defaultColorTypes[key] || 'background',
      })
    } else {
      const customColor = customHighlightColors.find((c: CustomColor) => c.id === colorKey)
      if (customColor) {
        openEditModal({ type: 'custom', color: customColor })
      }
    }
  }

  const handleOpenColorPicker = () => {
    setColorPickerModal({
      selectedColor: selectedVerseHighlightColor ?? undefined,
      onSelectColor: (colorId: string) => {
        addHighlight(colorId)
      },
    })
  }

  const modalProps = getModalProps()

  return (
    <>
      <ColorCircleGrid
        colors={colorItems}
        selectedColor={selectedVerseHighlightColor ?? undefined}
        onSelect={handleColorPress}
        onLongPress={handleLongPress}
        showAddButton
        onAddPress={handleOpenColorPicker}
        layout="scroll"
      />

      <ColorEditModal
        modalRef={modalRef}
        mode="edit"
        initialHex={modalProps.initialHex}
        initialName={modalProps.initialName}
        initialType={modalProps.initialType}
        onSave={handleSaveColor}
        onClose={() => setEditingColor(null)}
      />
    </>
  )
}

export default ColorCirclesBar
