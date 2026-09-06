import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { SheetHeader, SheetTextInput, type SheetRef } from '~common/sheet'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme, useTheme } from '~themes/ThemeProvider'

import ColorPicker from '~common/ColorPicker'
import { Sheet } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { HIGHLIGHT_BACKGROUND_OPACITY_HEX, getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { HighlightType } from '~redux/modules/user'
import { FeatherIcon } from './ui/Icon'

const StyledTextInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'flex-[1] text-[16px] py-[10px] px-[12px] bg-opacity5 rounded-[8px] text-default',
      className
    )
  )
  return (
    <SheetTextInput
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof SheetTextInput>['style']}
    />
  )
}

const TypeSelectorContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('flex-row mt-[10px]', className))
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const TypeButton = (
  componentProps: Omit<
    UIComponentProps<typeof TouchableOpacity>,
    keyof { isSelected: boolean } | 'theme'
  > &
    Omit<{ isSelected: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(
    twMerge('flex-[1] py-[10px] px-[8px] rounded-[8px] items-center', className)
  )
  return (
    <TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: isSelected ? theme.colors.primary : theme.colors.opacity5 },
          props.style,
        ] as UIComponentProps<typeof TouchableOpacity>['style']
      }
    />
  )
}

const PreviewContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('p-[15px] rounded-[8px] bg-opacity5 mt-[10px] mb-[15px] h-[80px]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

export type ColorEditModalProps = {
  modalRef: React.RefObject<SheetRef | null>
  mode: 'add' | 'edit'
  initialHex?: string
  initialName?: string
  initialType?: HighlightType
  onSave: (hex: string, name: string | undefined, type: HighlightType) => void
  onClose?: () => void
  onDelete?: () => void
}

const ColorEditModal = ({
  modalRef,
  mode,
  initialHex = '#ff7675',
  initialName = '',
  initialType = 'background',
  onSave,
  onClose,
  onDelete,
}: ColorEditModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()

  const [chosenHex, setChosenHex] = useState(initialHex)
  const [chosenName, setChosenName] = useState(initialName)
  const [chosenType, setChosenType] = useState<HighlightType>(initialType)

  const handlePresent = () => {
    setChosenHex(initialHex)
    setChosenName(initialName)
    setChosenType(initialType)
  }

  const handleColorChange = (color: ColorFormatsObject) => {
    setChosenHex(color.hex)
  }

  const handleSave = () => {
    const trimmedName = chosenName.trim() || undefined
    onSave(chosenHex, trimmedName, chosenType)
    modalRef.current?.dismiss()
  }

  const getModalTitle = () => {
    return mode === 'add'
      ? t('Nouvelle couleur')
      : `${t('Modifier {{name}}', { name: chosenName })}`
  }

  return (
    <Sheet
      ref={modalRef}
      onPresent={handlePresent}
      onDismiss={onClose}
      header={
        <SheetHeader
          title={getModalTitle()}
          rightComponent={
            onDelete ? (
              <TouchableBox
                className="overflow-hidden border-continuous w-[48px] h-[48px] items-center justify-center mr-[10px]"
                accessibilityLabel={t('Supprimer')}
                accessibilityRole="button"
                onPress={onDelete}
              >
                <FeatherIcon name="trash-2" size={16} color="quart" />
              </TouchableBox>
            ) : undefined
          }
        />
      }
    >
      <Box className="overflow-hidden border-continuous px-[20px] pb-[20px]">
        <Box className="overflow-hidden border-continuous h-[250px]">
          <ColorPicker value={chosenHex} onChangeJS={handleColorChange} />
        </Box>
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <StyledTextInput
            placeholder={t('Nom de la couleur (optionnel)')}
            placeholderTextColor={theme.colors.grey}
            value={chosenName}
            onChangeText={setChosenName}
            maxLength={30}
          />
        </Box>

        <Box className="overflow-hidden border-continuous my-[40px]">
          <Text className="text-[12px] text-tertiary">{t('Type de surlignage')}</Text>
          <TypeSelectorContainer>
            <TypeButton
              accessibilityLabel={t('Fond')}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosenType === 'background' }}
              isSelected={chosenType === 'background'}
              onPress={() => setChosenType('background')}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            >
              <Text
                className={twMerge(
                  chosenType === 'background' ? 'text-reverse' : 'text-default',
                  'text-[12px] font-bold'
                )}
              >
                {t('Fond')}
              </Text>
            </TypeButton>
            <TypeButton
              accessibilityLabel={t('Texte')}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosenType === 'textColor' }}
              isSelected={chosenType === 'textColor'}
              onPress={() => setChosenType('textColor')}
              style={{ borderRadius: 0 }}
            >
              <Text
                className={twMerge(
                  chosenType === 'textColor' ? 'text-reverse' : 'text-default',
                  'text-[12px] font-bold'
                )}
              >
                {t('Texte')}
              </Text>
            </TypeButton>
            <TypeButton
              accessibilityLabel={t('Soulignement')}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosenType === 'underline' }}
              isSelected={chosenType === 'underline'}
              onPress={() => setChosenType('underline')}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              <Text
                className={twMerge(
                  chosenType === 'underline' ? 'text-reverse' : 'text-default',
                  'text-[12px] font-bold'
                )}
              >
                {t('Soulignement')}
              </Text>
            </TypeButton>
          </TypeSelectorContainer>

          <PreviewContainer>
            <HStack className="overflow-hidden border-continuous gap-[10px]">
              <Text className="text-[12px] text-tertiary mb-[8px]">{t('Aperçu')}</Text>
              <Text className="text-[12px] text-default">{chosenHex}</Text>
            </HStack>
            <Text
              className="text-[18px]"
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
        </Box>
        <Button onPress={handleSave}>{t('Valider')}</Button>
      </Box>
    </Sheet>
  )
}

export default ColorEditModal
