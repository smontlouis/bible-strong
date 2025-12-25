import React, { useState, useEffect } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import ColorPicker from '~common/ColorPicker'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import type { HighlightType } from '~redux/modules/user'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { HIGHLIGHT_BACKGROUND_OPACITY_HEX, getContrastTextColor } from '~helpers/highlightUtils'

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

export type ColorEditModalProps = {
  modalRef: React.RefObject<BottomSheetModal | null>
  mode: 'add' | 'edit'
  initialHex?: string
  initialName?: string
  initialType?: HighlightType
  onSave: (hex: string, name: string | undefined, type: HighlightType) => void
  onClose?: () => void
}

const ColorEditModal = ({
  modalRef,
  mode,
  initialHex = '#ff7675',
  initialName = '',
  initialType = 'background',
  onSave,
  onClose,
}: ColorEditModalProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()

  const [chosenHex, setChosenHex] = useState(initialHex)
  const [chosenName, setChosenName] = useState(initialName)
  const [chosenType, setChosenType] = useState<HighlightType>(initialType)

  // Reset state when modal opens with new initial values
  useEffect(() => {
    setChosenHex(initialHex)
    setChosenName(initialName)
    setChosenType(initialType)
  }, [initialHex, initialName, initialType])

  const handleColorChange = (color: ColorFormatsObject) => {
    setChosenHex(color.hex)
  }

  const handleSave = () => {
    const trimmedName = chosenName.trim() || undefined
    onSave(chosenHex, trimmedName, chosenType)
    modalRef.current?.dismiss()
  }

  const handleClose = () => {
    modalRef.current?.dismiss()
    onClose?.()
  }

  const getModalTitle = () => {
    return mode === 'add' ? t('Nouvelle couleur') : t('Modifier la couleur')
  }

  return (
    <Modal.Body
      ref={modalRef}
      topInset={insets.top}
      enableDynamicSizing
      onModalClose={handleClose}
      headerComponent={<ModalHeader title={getModalTitle()} />}
    >
      <Box paddingHorizontal={20} pb={20}>
        <Box height={250}>
          <ColorPicker value={chosenHex} onChangeJS={handleColorChange} />
        </Box>
        <Box row alignItems="center">
          <StyledTextInput
            placeholder={t('Nom de la couleur (optionnel)')}
            placeholderTextColor={theme.colors.tertiary}
            value={chosenName}
            onChangeText={setChosenName}
            maxLength={30}
          />
        </Box>

        <Text fontSize={12} color="tertiary" marginTop={20}>
          {t('Type de surlignage')}
        </Text>
        <TypeSelectorContainer>
          <TypeButton
            isSelected={chosenType === 'background'}
            onPress={() => setChosenType('background')}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          >
            <Text fontSize={12} bold color={chosenType === 'background' ? 'reverse' : 'default'}>
              {t('Fond')}
            </Text>
          </TypeButton>
          <TypeButton
            isSelected={chosenType === 'textColor'}
            onPress={() => setChosenType('textColor')}
            style={{ borderRadius: 0 }}
          >
            <Text fontSize={12} bold color={chosenType === 'textColor' ? 'reverse' : 'default'}>
              {t('Texte')}
            </Text>
          </TypeButton>
          <TypeButton
            isSelected={chosenType === 'underline'}
            onPress={() => setChosenType('underline')}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          >
            <Text fontSize={12} bold color={chosenType === 'underline' ? 'reverse' : 'default'}>
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
              {chosenHex}
            </Text>
          </HStack>
          <Text
            fontSize={18}
            style={
              chosenType === 'background'
                ? {
                    backgroundColor: `${chosenHex}${HIGHLIGHT_BACKGROUND_OPACITY_HEX}`,
                    borderRadius: 4,
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                    color:
                      getContrastTextColor(chosenHex, colorScheme === 'dark') ??
                      theme.colors.default,
                  }
                : chosenType === 'textColor'
                  ? { color: chosenHex }
                  : {
                      borderBottomWidth: 4,
                      borderBottomColor: `${chosenHex}99`,
                    }
            }
          >
            {t('Exemple de verset')}
          </Text>
        </PreviewContainer>

        <Button onPress={handleSave}>{t('Valider')}</Button>
      </Box>
    </Modal.Body>
  )
}

export default ColorEditModal
