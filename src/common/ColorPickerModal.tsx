import { useEffect, useRef, useState } from 'react'
import { Alert, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import ColorEditModal from '~common/ColorEditModal'
import ModalHeader from '~common/ModalHeader'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useHighlightColors } from '~helpers/useHighlightColors'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { colorPickerModalAtom } from '~state/app'
import {
  addCustomColor,
  changeColor,
  CustomColor,
  deleteCustomColor,
  HighlightType,
  removeHighlight,
  setDefaultColorName,
  setDefaultColorType,
  updateCustomColor,
} from '~redux/modules/user'
import { removeWordAnnotation } from '~redux/modules/user/wordAnnotations'
import type { RootState } from '~redux/modules/reducer'
import getTheme from '~themes/index'
import defaultColors from '~themes/colors'
import { EMPTY_OBJECT } from '~helpers/emptyReferences'
import { MAX_CUSTOM_COLORS } from '~helpers/constants'

type ColorKey = keyof typeof defaultColors

const ColorRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const SectionTitle = styled(Text)(({ theme }) => ({
  fontSize: 12,
  color: theme.colors.tertiary,
  marginTop: 15,
  marginBottom: 10,
  marginLeft: 15,
  textTransform: 'uppercase',
}))

const IconButton = styled(TouchableOpacity)({
  padding: 8,
})

type ModalState = {
  mode: 'add' | 'edit-default' | 'edit-custom'
  colorKey?: ColorKey
  customColor?: CustomColor
  chosenHex: string
  chosenName: string
  chosenType: HighlightType
  onDelete?: () => void
}

const ColorPickerModal = () => {
  const item = useAtomValue(colorPickerModalAtom)
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)
  const { ref, open, close } = useBottomSheetModal()
  const editModalRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const { theme: currentTheme } = useCurrentThemeSelector()
  const { colors: themeColors, customHighlightColors, defaultColorTypes } = useHighlightColors()

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_OBJECT,
    shallowEqual
  )

  const highlightsObj = useSelector((state: RootState) => state.user.bible.highlights, shallowEqual)

  const wordAnnotationsObj = useSelector(
    (state: RootState) => state.user.bible.wordAnnotations ?? EMPTY_OBJECT,
    shallowEqual
  )

  const [modalState, setModalState] = useState<ModalState>({
    mode: 'add',
    chosenHex: '#ff7675',
    chosenName: '',
    chosenType: 'background',
    onDelete: undefined,
  })

  // Auto-open when atom changes
  useEffect(() => {
    if (item) {
      open()
    }
  }, [item, open])

  const isSelectionMode = item && item.onSelectColor

  const handleColorSelect = (colorId: string) => {
    if (item && item.onSelectColor) {
      item.onSelectColor(colorId)
      close()
      setColorPickerModal(false)
    }
  }

  const getTotalUsageCount = (colorId: string) => {
    const highlightCount = Object.values(highlightsObj).filter(h => h.color === colorId).length
    const annotationCount = Object.values(wordAnnotationsObj).filter(
      a => a.color === colorId
    ).length
    return highlightCount + annotationCount
  }

  // Open modal for adding a new custom color
  const openAddModal = () => {
    setModalState({
      mode: 'add',
      chosenHex: '#ff7675',
      chosenName: '',
      chosenType: 'background',
    })
    editModalRef.current?.present()
  }

  // Open modal for editing a default color
  const openEditDefaultModal = (colorKey: ColorKey, currentHex: string, index: number) => {
    const currentType =
      defaultColorTypes[colorKey as keyof typeof defaultColorTypes] || 'background'
    setModalState({
      mode: 'edit-default',
      colorKey,
      chosenHex: currentHex,
      chosenName:
        defaultColorNames[colorKey as keyof typeof defaultColorNames] ??
        `${t('Couleur')} ${index + 1}`,
      chosenType: currentType,
    })
    editModalRef.current?.present()
  }

  // Open modal for editing a custom color
  const openEditCustomModal = (color: CustomColor, index: number) => {
    setModalState({
      mode: 'edit-custom',
      customColor: color,
      chosenHex: color.hex,
      chosenName: color.name ?? `${t('Couleur personnalisée')} ${index + 1}`,
      chosenType: color.type || 'background',
      onDelete: () => handleDeleteCustomColor(color),
    })
    editModalRef.current?.present()
  }

  const handleSave = (hex: string, name: string | undefined, type: HighlightType) => {
    if (modalState.mode === 'add') {
      dispatch(addCustomColor(hex, name, type))
    } else if (modalState.mode === 'edit-default' && modalState.colorKey) {
      dispatch(changeColor({ name: modalState.colorKey, color: hex }))
      dispatch(setDefaultColorName(modalState.colorKey, name))
      dispatch(setDefaultColorType(modalState.colorKey, type))
    } else if (modalState.mode === 'edit-custom' && modalState.customColor) {
      dispatch(updateCustomColor(modalState.customColor.id, hex, name, type))
    }
  }

  const resetDefaultColor = (colorKey: ColorKey) => {
    dispatch(changeColor({ name: colorKey }))
    dispatch(setDefaultColorType(colorKey, 'background'))
    dispatch(setDefaultColorName(colorKey, undefined))
  }

  const getHighlightsWithColor = (colorId: string) => {
    return Object.entries(highlightsObj)
      .filter(([, h]) => h.color === colorId)
      .reduce((acc, [verseId]) => ({ ...acc, [verseId]: true }), {})
  }

  const getAnnotationsWithColor = (colorId: string) => {
    return Object.entries(wordAnnotationsObj)
      .filter(([, a]) => a.color === colorId)
      .map(([id]) => id)
  }

  const deleteColorAndHighlightsAndAnnotations = (colorId: string) => {
    const highlightsToDelete = getHighlightsWithColor(colorId)
    if (Object.keys(highlightsToDelete).length > 0) {
      dispatch(removeHighlight({ selectedVerses: highlightsToDelete }))
    }

    const annotationIds = getAnnotationsWithColor(colorId)
    annotationIds.forEach(id => {
      dispatch(removeWordAnnotation(id))
    })

    dispatch(deleteCustomColor(colorId))
  }

  const handleDeleteCustomColor = (color: CustomColor) => {
    const totalCount = getTotalUsageCount(color.id)

    if (totalCount > 0) {
      Alert.alert(
        t('Supprimer la couleur'),
        t(
          'Cette couleur est utilisée par {{count}} surbrillance(s). Elles seront également supprimées.',
          { count: totalCount }
        ),
        [
          { text: t('Annuler'), style: 'cancel' },
          {
            text: t('Supprimer'),
            style: 'destructive',
            onPress: () => {
              deleteColorAndHighlightsAndAnnotations(color.id)
              editModalRef.current?.dismiss()
            },
          },
        ]
      )
    } else {
      dispatch(deleteCustomColor(color.id))
      editModalRef.current?.dismiss()
    }
  }

  // Check if default color has been modified from its original value
  const isDefaultColorModified = (colorKey: ColorKey) => {
    const currentColor = themeColors[colorKey as keyof typeof themeColors]
    const themeDefaults = getTheme[currentTheme]?.colors
    const originalColor = themeDefaults?.[colorKey as keyof typeof themeDefaults]
    const currentType = defaultColorTypes[colorKey as keyof typeof defaultColorTypes]
    const isTypeModified = currentType && currentType !== 'background'
    const currentName = defaultColorNames[colorKey as keyof typeof defaultColorNames]
    const isNameModified = !!currentName
    return currentColor !== originalColor || isTypeModified || isNameModified
  }

  const handleModalClose = () => {
    setColorPickerModal(false)
  }

  return (
    <>
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
        <ModalHeader title={t('Palette de couleurs')} />
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <SectionTitle>{t('Couleurs par défaut')}</SectionTitle>
          {([1, 2, 3, 4, 5] as const).map(i => {
            const colorKey = `color${i}` as ColorKey
            const currentHex = themeColors[colorKey as keyof typeof themeColors]
            const currentType =
              defaultColorTypes[colorKey as keyof typeof defaultColorTypes] || 'background'
            const isModified = isDefaultColorModified(colorKey)
            const colorName = defaultColorNames[colorKey as keyof typeof defaultColorNames]
            const isSelected = item && item.selectedColor === colorKey

            return (
              <ColorRow key={i}>
                <TouchableBox
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    overflow: 'visible',
                  }}
                  onPress={isSelectionMode ? () => handleColorSelect(colorKey) : undefined}
                  activeOpacity={isSelectionMode ? 0.7 : 1}
                  overflow="visible"
                >
                  <Box marginRight={10} overflow="visible">
                    <HighlightTypeIndicator
                      color={currentHex}
                      type={currentType}
                      size={30}
                      isSelected={isSelected}
                    />
                  </Box>
                  <Text bold fontSize={14} flex={1}>
                    {colorName || `${t('Couleur')} ${i}`}
                  </Text>
                </TouchableBox>
                <Text color="tertiary" fontSize={12} marginRight={10}>
                  {getTotalUsageCount(`color${i}`)} {t('surbrillance(s)')}
                </Text>
                {isModified && (
                  <IconButton
                    onPress={() => resetDefaultColor(colorKey)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <FeatherIcon name="refresh-cw" size={14} color="grey" />
                  </IconButton>
                )}
                <IconButton
                  onPress={() => openEditDefaultModal(colorKey, currentHex, i)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FeatherIcon name="settings" size={16} color="grey" />
                </IconButton>
              </ColorRow>
            )
          })}

          <SectionTitle>{t('Mes couleurs')}</SectionTitle>
          {customHighlightColors.length === 0 && (
            <Box paddingHorizontal={15} paddingVertical={10}>
              <Text color="tertiary" fontSize={13}>
                {t('Aucune couleur personnalisée')}
              </Text>
            </Box>
          )}
          {customHighlightColors.map((color: CustomColor, index: number) => {
            const isSelected = item && item.selectedColor === color.id

            return (
              <ColorRow key={color.id}>
                <TouchableBox
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    overflow: 'visible',
                  }}
                  onPress={isSelectionMode ? () => handleColorSelect(color.id) : undefined}
                  activeOpacity={isSelectionMode ? 0.7 : 1}
                  overflow="visible"
                >
                  <Box marginRight={10} overflow="visible">
                    <HighlightTypeIndicator
                      color={color.hex}
                      type={color.type || 'background'}
                      size={30}
                      isSelected={isSelected}
                    />
                  </Box>
                  <Text bold fontSize={14} flex={1}>
                    {color.name || `${t('Couleur personnalisée')} ${index + 1}`}
                  </Text>
                </TouchableBox>
                <Text color="tertiary" fontSize={12} marginRight={10}>
                  {getTotalUsageCount(color.id)} {t('surbrillance(s)')}
                </Text>

                <IconButton
                  onPress={() => openEditCustomModal(color, index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FeatherIcon name="settings" size={16} color="grey" />
                </IconButton>
              </ColorRow>
            )
          })}

          {customHighlightColors.length < MAX_CUSTOM_COLORS && (
            <TouchableOpacity onPress={openAddModal}>
              <Box row alignItems="center" padding={15}>
                <Box
                  width={30}
                  height={30}
                  borderRadius={10}
                  backgroundColor="opacity5"
                  marginRight={10}
                  center
                >
                  <FeatherIcon name="plus" size={20} />
                </Box>
                <Text bold color="primary">
                  {t('Ajouter une couleur')}
                </Text>
              </Box>
            </TouchableOpacity>
          )}

          {customHighlightColors.length >= MAX_CUSTOM_COLORS && (
            <Box padding={15}>
              <Text color="tertiary" fontSize={12}>
                {t('Limite de 5 couleurs personnalisées atteinte')}
              </Text>
            </Box>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <ColorEditModal
        modalRef={editModalRef}
        mode={modalState.mode === 'add' ? 'add' : 'edit'}
        initialHex={modalState.chosenHex}
        initialName={modalState.chosenName}
        initialType={modalState.chosenType}
        onSave={handleSave}
        onDelete={modalState.onDelete}
      />
    </>
  )
}

export default ColorPickerModal
