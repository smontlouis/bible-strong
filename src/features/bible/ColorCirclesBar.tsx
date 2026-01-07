import React, { useMemo, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { shallowEqual, useSelector, useDispatch } from 'react-redux'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import Box from '~common/ui/Box'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import ColorEditModal from '~common/ColorEditModal'
import { wp } from '~helpers/utils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor, HighlightType } from '~redux/modules/user'
import {
  changeColor,
  setDefaultColorName,
  setDefaultColorType,
  updateCustomColor,
} from '~redux/modules/user'
import { makeColorsSelector } from '~redux/selectors/user'
import { EMPTY_ARRAY, EMPTY_OBJECT } from '~helpers/emptyReferences'
import TouchableIcon from './TouchableIcon'

type DefaultColorKey = 'color1' | 'color2' | 'color3' | 'color4' | 'color5'

type EditingColor =
  | {
      type: 'default'
      colorKey: DefaultColorKey
      hex: string
      name?: string
      highlightType: HighlightType
    }
  | { type: 'custom'; color: CustomColor }

const MIN_ITEM_WIDTH = 40 // Minimum width (circle size + margins)

type Props = {
  isSelectedVerseHighlighted: boolean
  addHighlight: (color: string) => void
  removeHighlight: () => void
  onClose: () => void
}

const ColorCirclesBar = ({
  isSelectedVerseHighlighted,
  addHighlight,
  removeHighlight,
  onClose,
}: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const modalRef = useRef<BottomSheetModal>(null)
  const [editingColor, setEditingColor] = useState<EditingColor | null>(null)

  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const colors = useSelector((state: RootState) => selectColors(state, currentTheme))
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? EMPTY_ARRAY
  )
  const defaultColorTypes = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorTypes ?? EMPTY_OBJECT,
    shallowEqual
  )
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

  // Calculate dynamic item width for color circles
  const screenWidth = wp(100, 500)
  const colorItemCount = useMemo(() => {
    let count = 5 // 5 default colors
    count += customHighlightColors.length // custom colors
    if (customHighlightColors.length < 5) count += 1 // plus button
    if (isSelectedVerseHighlighted) count += 1 // x button
    return count
  }, [customHighlightColors.length, isSelectedVerseHighlighted])

  const colorItemWidth = Math.max(screenWidth / colorItemCount, MIN_ITEM_WIDTH)

  const modalProps = getModalProps()

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {isSelectedVerseHighlighted && (
          <Box width={colorItemWidth} height={60} center>
            <TouchableIcon name="x-circle" onPress={removeHighlight} noFlex />
          </Box>
        )}
        {(['color1', 'color2', 'color3', 'color4', 'color5'] as const).map((colorKey, index) => {
          const currentHex = colors[colorKey]
          const currentType = defaultColorTypes[colorKey] || 'background'
          const currentName = defaultColorNames[colorKey]
          return (
            <Box key={colorKey} width={colorItemWidth} height={60} center>
              <HighlightTypeIndicator
                color={currentHex}
                type={currentType}
                onPress={() => addHighlight(colorKey)}
                onLongPress={() =>
                  openEditModal({
                    type: 'default',
                    colorKey,
                    hex: currentHex,
                    name: currentName,
                    highlightType: currentType,
                  })
                }
                size={20}
              />
            </Box>
          )
        })}
        {customHighlightColors.map((customColor: CustomColor) => (
          <Box key={customColor.id} width={colorItemWidth} height={60} center>
            <HighlightTypeIndicator
              color={customColor.hex}
              type={customColor.type || 'background'}
              onPress={() => addHighlight(customColor.id)}
              onLongPress={() => openEditModal({ type: 'custom', color: customColor })}
              size={20}
            />
          </Box>
        ))}

        <Box width={colorItemWidth} height={60} center>
          <TouchableIcon
            name={customHighlightColors.length < 5 ? 'plus-circle' : 'arrow-right-circle'}
            onPress={() => {
              router.push('/custom-highlight-colors')
            }}
            noFlex
          />
        </Box>
      </ScrollView>

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
