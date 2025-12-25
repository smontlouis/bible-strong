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
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Button from '~common/ui/Button'
import ColorPicker from '~common/ColorPicker'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { FeatherIcon } from '~common/ui/Icon'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import {
  addCustomColor,
  updateCustomColor,
  deleteCustomColor,
  removeHighlight,
  changeColor,
  setDefaultColorName,
  setDefaultColorType,
  CustomColor,
  HighlightType,
} from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { makeColorsSelector } from '~redux/selectors/user'
import { HIGHLIGHT_BACKGROUND_OPACITY_HEX, getContrastTextColor } from '~helpers/highlightUtils'
import getTheme from '~themes/index'
import defaultColors from '~themes/colors'

type ColorKey = keyof typeof defaultColors

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

const TypeSelectorContainer = styled.View({
  flexDirection: 'row',
  marginTop: 15,
})

const TypeButton = styled(TouchableOpacity)<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderRadius: 20,
  backgroundColor: isSelected ? theme.colors.primary : theme.colors.opacity5,
  alignItems: 'center',
}))

const PreviewContainer = styled.View(({ theme }) => ({
  padding: 15,
  borderRadius: 8,
  backgroundColor: theme.colors.opacity5,
  marginTop: 10,
  marginBottom: 15,
  height: 80,
}))

const MAX_CUSTOM_COLORS = 5

type ModalState = {
  mode: 'add' | 'edit-default' | 'edit-custom'
  colorKey?: ColorKey // For default colors: 'color1', 'color2', etc.
  customColor?: CustomColor // For custom colors
  chosenHex: string
  chosenName: string
  chosenType: HighlightType
}

const CustomHighlightColorsScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const modalRef = useRef<BottomSheetModal>(null)
  const { theme: currentTheme, colorScheme } = useCurrentThemeSelector()
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

  const defaultColorTypes = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorTypes ?? {},
    shallowEqual
  )

  const highlightsObj = useSelector((state: RootState) => state.user.bible.highlights, shallowEqual)

  const [modalState, setModalState] = useState<ModalState>({
    mode: 'add',
    chosenHex: '#ff7675',
    chosenName: '',
    chosenType: 'background',
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
      chosenType: 'background',
    })
    modalRef.current?.present()
  }

  // Open modal for editing a default color
  const openEditDefaultModal = (colorKey: ColorKey, currentHex: string) => {
    const currentType =
      defaultColorTypes[colorKey as keyof typeof defaultColorTypes] || 'background'
    setModalState({
      mode: 'edit-default',
      colorKey,
      chosenHex: currentHex,
      chosenName: defaultColorNames[colorKey as keyof typeof defaultColorNames] ?? '',
      chosenType: currentType,
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
      chosenType: color.type || 'background',
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

  const handleTypeChange = (type: HighlightType) => {
    setModalState(prev => ({
      ...prev,
      chosenType: type,
    }))
  }

  const handleSave = () => {
    const trimmedName = modalState.chosenName.trim() || undefined
    if (modalState.mode === 'add') {
      dispatch(addCustomColor(modalState.chosenHex, trimmedName, modalState.chosenType))
    } else if (modalState.mode === 'edit-default' && modalState.colorKey) {
      dispatch(changeColor({ name: modalState.colorKey, color: modalState.chosenHex }))
      dispatch(setDefaultColorName(modalState.colorKey, trimmedName))
      dispatch(setDefaultColorType(modalState.colorKey, modalState.chosenType))
    } else if (modalState.mode === 'edit-custom' && modalState.customColor) {
      dispatch(
        updateCustomColor(
          modalState.customColor.id,
          modalState.chosenHex,
          trimmedName,
          modalState.chosenType
        )
      )
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
          const currentType =
            defaultColorTypes[colorKey as keyof typeof defaultColorTypes] || 'background'
          const isModified = isDefaultColorModified(colorKey)
          const colorName = defaultColorNames[colorKey as keyof typeof defaultColorNames]
          return (
            <ColorRow key={i} activeOpacity={1}>
              <Box marginRight={10}>
                <HighlightTypeIndicator color={currentHex} type={currentType} size={30} />
              </Box>
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
            <Box marginRight={10}>
              <HighlightTypeIndicator
                color={color.hex}
                type={color.type || 'background'}
                size={30}
              />
            </Box>
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
          <Box row alignItems="center">
            <StyledTextInput
              placeholder={t('Nom de la couleur (optionnel)')}
              placeholderTextColor={theme.colors.tertiary}
              value={modalState.chosenName}
              onChangeText={handleNameChange}
              maxLength={30}
            />
          </Box>

          <Text fontSize={12} color="tertiary" marginTop={20}>
            {t('Type de surlignage')}
          </Text>
          <TypeSelectorContainer>
            <TypeButton
              isSelected={modalState.chosenType === 'background'}
              onPress={() => handleTypeChange('background')}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            >
              <Text
                fontSize={12}
                bold
                color={modalState.chosenType === 'background' ? 'reverse' : 'default'}
              >
                {t('Fond')}
              </Text>
            </TypeButton>
            <TypeButton
              isSelected={modalState.chosenType === 'textColor'}
              onPress={() => handleTypeChange('textColor')}
              style={{ borderRadius: 0 }}
            >
              <Text
                fontSize={12}
                bold
                color={modalState.chosenType === 'textColor' ? 'reverse' : 'default'}
              >
                {t('Texte')}
              </Text>
            </TypeButton>
            <TypeButton
              isSelected={modalState.chosenType === 'underline'}
              onPress={() => handleTypeChange('underline')}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              <Text
                fontSize={12}
                bold
                color={modalState.chosenType === 'underline' ? 'reverse' : 'default'}
              >
                {t('Soulignement')}
              </Text>
            </TypeButton>
          </TypeSelectorContainer>

          <PreviewContainer>
            <HStack gap={10}>
              <Text fontSize={12} color="tertiary" marginBottom={8}>
                {t('Aperçu')}
              </Text>
              <Text fontSize={12} color="default">
                {modalState.chosenHex}
              </Text>
            </HStack>
            <Text
              fontSize={18}
              style={
                modalState.chosenType === 'background'
                  ? {
                      backgroundColor: `${modalState.chosenHex}${HIGHLIGHT_BACKGROUND_OPACITY_HEX}`,
                      borderRadius: 4,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      color:
                        getContrastTextColor(modalState.chosenHex, colorScheme === 'dark') ??
                        theme.colors.default,
                    }
                  : modalState.chosenType === 'textColor'
                    ? { color: modalState.chosenHex }
                    : {
                        borderBottomWidth: 4,
                        borderBottomColor: `${modalState.chosenHex}99`,
                      }
              }
            >
              {t('Exemple de verset')}
            </Text>
          </PreviewContainer>

          <Button onPress={handleSave}>{t('Valider')}</Button>
        </Box>
      </Modal.Body>
    </Container>
  )
}

export default CustomHighlightColorsScreen
