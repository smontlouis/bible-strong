import React, { useRef, useState } from 'react'
import { Alert, ScrollView, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { useTheme } from '@emotion/react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Button from '~common/ui/Button'
import ColorPicker from '~common/ColorPicker'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { FeatherIcon } from '~common/ui/Icon'
import {
  addCustomColor,
  updateCustomColor,
  deleteCustomColor,
  removeHighlight,
  changeColor,
  setDefaultColorName,
  CustomColor,
} from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { makeColorsSelector } from '~redux/selectors/user'
import getTheme from '~themes/index'
import defaultColors from '~themes/colors'

type ColorKey = keyof typeof defaultColors

const ColorSquare = styled.View(({ color, size }: { color: string; size: number }) => ({
  width: size,
  height: size,
  borderRadius: size / 4,
  backgroundColor: color,
  marginRight: 10,
}))

const ColorRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const SectionTitle = styled(Text)(({ theme }) => ({
  fontSize: 12,
  color: theme.colors.tertiary,
  marginTop: 20,
  marginBottom: 10,
  marginLeft: 15,
  textTransform: 'uppercase',
}))

const IconButton = styled(TouchableOpacity)({
  padding: 8,
})

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  flex: 1,
  fontSize: 14,
  paddingVertical: 8,
  paddingHorizontal: 12,
  backgroundColor: theme.colors.opacity5,
  borderRadius: 8,
  color: theme.colors.default,
}))

const MAX_CUSTOM_COLORS = 5

type ModalState = {
  mode: 'add' | 'edit-default' | 'edit-custom'
  colorKey?: ColorKey // For default colors: 'color1', 'color2', etc.
  customColor?: CustomColor // For custom colors
  chosenHex: string
  chosenName: string
}

const CustomHighlightColorsScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const modalRef = useRef<BottomSheetModal>(null)
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = makeColorsSelector()
  const themeColors = useSelector((state: RootState) => selectColors(state, currentTheme))

  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? [],
    shallowEqual
  )

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? {},
    shallowEqual
  )

  const highlightsObj = useSelector((state: RootState) => state.user.bible.highlights, shallowEqual)

  const [modalState, setModalState] = useState<ModalState>({
    mode: 'add',
    chosenHex: '#ff7675',
    chosenName: '',
  })

  const getColorUsageCount = (colorId: string) => {
    return Object.values(highlightsObj).filter(h => h.color === colorId).length
  }

  // Open modal for adding a new custom color
  const openAddModal = () => {
    setModalState({
      mode: 'add',
      chosenHex: '#ff7675',
      chosenName: '',
    })
    modalRef.current?.present()
  }

  // Open modal for editing a default color
  const openEditDefaultModal = (colorKey: ColorKey, currentHex: string) => {
    setModalState({
      mode: 'edit-default',
      colorKey,
      chosenHex: currentHex,
      chosenName: defaultColorNames[colorKey as keyof typeof defaultColorNames] ?? '',
    })
    modalRef.current?.present()
  }

  // Open modal for editing a custom color
  const openEditCustomModal = (color: CustomColor) => {
    setModalState({
      mode: 'edit-custom',
      customColor: color,
      chosenHex: color.hex,
      chosenName: color.name ?? '',
    })
    modalRef.current?.present()
  }

  const closeModal = () => {
    modalRef.current?.dismiss()
  }

  const handleColorChange = (color: ColorFormatsObject) => {
    setModalState(prev => ({
      ...prev,
      chosenHex: color.hex,
    }))
  }

  const handleNameChange = (name: string) => {
    setModalState(prev => ({
      ...prev,
      chosenName: name,
    }))
  }

  const handleSave = () => {
    const trimmedName = modalState.chosenName.trim() || undefined
    if (modalState.mode === 'add') {
      dispatch(addCustomColor(modalState.chosenHex, trimmedName))
    } else if (modalState.mode === 'edit-default' && modalState.colorKey) {
      dispatch(changeColor({ name: modalState.colorKey, color: modalState.chosenHex }))
      dispatch(setDefaultColorName(modalState.colorKey, trimmedName))
    } else if (modalState.mode === 'edit-custom' && modalState.customColor) {
      dispatch(updateCustomColor(modalState.customColor.id, modalState.chosenHex, trimmedName))
    }
    closeModal()
  }

  const resetDefaultColor = (colorKey: ColorKey) => {
    dispatch(changeColor({ name: colorKey }))
  }

  const getHighlightsWithColor = (colorId: string) => {
    return Object.entries(highlightsObj)
      .filter(([, h]) => h.color === colorId)
      .reduce((acc, [verseId]) => ({ ...acc, [verseId]: true }), {})
  }

  const deleteColorAndHighlights = (colorId: string) => {
    const highlightsToDelete = getHighlightsWithColor(colorId)
    if (Object.keys(highlightsToDelete).length > 0) {
      dispatch(removeHighlight({ selectedVerses: highlightsToDelete }))
    }
    dispatch(deleteCustomColor(colorId))
  }

  const handleDeleteCustomColor = (color: CustomColor) => {
    const usageCount = getColorUsageCount(color.id)

    if (usageCount > 0) {
      Alert.alert(
        t('Supprimer la couleur'),
        t('Cette couleur est utilisée par {{count}} verset(s). Ils seront également supprimés.', {
          count: usageCount,
        }),
        [
          { text: t('Annuler'), style: 'cancel' },
          {
            text: t('Supprimer'),
            style: 'destructive',
            onPress: () => deleteColorAndHighlights(color.id),
          },
        ]
      )
    } else {
      dispatch(deleteCustomColor(color.id))
    }
  }

  const getModalTitle = () => {
    switch (modalState.mode) {
      case 'add':
        return t('Nouvelle couleur')
      case 'edit-default':
        return t('Modifier la couleur')
      case 'edit-custom':
        return t('Modifier la couleur')
      default:
        return ''
    }
  }

  // Check if default color has been modified from its original value
  const isDefaultColorModified = (colorKey: ColorKey) => {
    const currentColor = themeColors[colorKey as keyof typeof themeColors]
    const themeDefaults = getTheme[currentTheme]?.colors
    const originalColor = themeDefaults?.[colorKey as keyof typeof themeDefaults]
    return currentColor !== originalColor
  }

  return (
    <Container>
      <Header hasBackButton title={t('Couleurs de surlignage')} />
      <ScrollView>
        <SectionTitle>{t('Couleurs par défaut')}</SectionTitle>
        {([1, 2, 3, 4, 5] as const).map(i => {
          const colorKey = `color${i}` as ColorKey
          const currentHex = themeColors[colorKey as keyof typeof themeColors]
          const isModified = isDefaultColorModified(colorKey)
          const colorName = defaultColorNames[colorKey as keyof typeof defaultColorNames]
          return (
            <ColorRow key={i} activeOpacity={1}>
              <ColorSquare size={30} color={currentHex} />
              <Text bold fontSize={14} flex={1}>
                {colorName || `${t('Couleur')} ${i}`}
              </Text>
              <Text color="tertiary" fontSize={12} marginRight={10}>
                {getColorUsageCount(`color${i}`)} {t('verset(s)')}
              </Text>
              {isModified && (
                <IconButton
                  onPress={() => resetDefaultColor(colorKey)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FeatherIcon name="refresh-cw" size={18} color="tertiary" />
                </IconButton>
              )}
              <IconButton
                onPress={() => openEditDefaultModal(colorKey, currentHex)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FeatherIcon name="edit-2" size={18} color="primary" />
              </IconButton>
            </ColorRow>
          )
        })}

        <SectionTitle>{t('Mes couleurs')}</SectionTitle>
        {customHighlightColors.map((color: CustomColor, index: number) => (
          <ColorRow key={color.id} activeOpacity={1}>
            <ColorSquare size={30} color={color.hex} />
            <Text bold fontSize={14} flex={1}>
              {color.name || `${t('Couleur personnalisée')} ${index + 1}`}
            </Text>
            <Text color="tertiary" fontSize={12} marginRight={10}>
              {getColorUsageCount(color.id)} {t('verset(s)')}
            </Text>
            <IconButton
              onPress={() => handleDeleteCustomColor(color)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FeatherIcon name="trash-2" size={18} color="quart" />
            </IconButton>
            <IconButton
              onPress={() => openEditCustomModal(color)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FeatherIcon name="edit-2" size={18} color="primary" />
            </IconButton>
          </ColorRow>
        ))}

        {customHighlightColors.length < MAX_CUSTOM_COLORS && (
          <TouchableOpacity onPress={openAddModal}>
            <Box row alignItems="center" padding={15}>
              <Box
                width={30}
                height={30}
                borderRadius={7.5}
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
      </ScrollView>

      <Modal.Body
        ref={modalRef}
        topInset={insets.top}
        enableDynamicSizing
        onModalClose={closeModal}
        headerComponent={<ModalHeader title={getModalTitle()} />}
      >
        <Box paddingHorizontal={20} pb={20}>
          <Box height={250}>
            <ColorPicker value={modalState.chosenHex} onChangeJS={handleColorChange} />
          </Box>
          <Box row alignItems="center" marginBottom={10}>
            <ColorSquare size={40} color={modalState.chosenHex} />
            <Text bold marginLeft={10}>
              {modalState.chosenHex}
            </Text>
          </Box>
          <Box row alignItems="center">
            <StyledTextInput
              placeholder={t('Nom de la couleur (optionnel)')}
              placeholderTextColor={theme.colors.tertiary}
              value={modalState.chosenName}
              onChangeText={handleNameChange}
              maxLength={30}
            />
            <Box marginLeft={10}>
              <Button small onPress={handleSave}>
                {t('Valider')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal.Body>
    </Container>
  )
}

export default CustomHighlightColorsScreen
