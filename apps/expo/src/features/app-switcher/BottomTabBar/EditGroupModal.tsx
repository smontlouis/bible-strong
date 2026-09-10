import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput as RNTextInput } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import { SheetFooter, SheetHeader, SheetTextInput, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import { GROUP_COLORS } from '../../../state/tabs'
import InlineSheetContent from '~common/ContextualPanel/InlineSheetContent'

const StyledTextInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'text-default h-[48px] border-border border-[2px] rounded-[10px] px-[15px] text-[16px]',
    className
  )
  return (
    <SheetTextInput
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof SheetTextInput>['style']}
    />
  )
}

interface EditGroupModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  title?: string
  initialName?: string
  initialColor?: string
  onSave: (data: { name: string; color: string }) => void
  onClose?: () => void
  inline?: boolean
}

const EditGroupModal = ({
  sheetRef,
  title,
  initialName = '',
  initialColor = GROUP_COLORS[0],
  onSave,
  onClose,
  inline = false,
}: EditGroupModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const [name, setName] = useState(initialName)
  const [selectedColor, setSelectedColor] = useState(initialColor)
  const inputRef = React.useRef<RNTextInput>(null)

  const scheduleInputFocus = () => {
    inputRef.current?.focus()
  }

  const handleClose = () => {
    if (inline) onClose?.()
    else sheetRef.current?.dismiss()
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color: selectedColor })
    handleClose()
  }

  const handlePresent = () => {
    setName(initialName)
    setSelectedColor(initialColor || GROUP_COLORS[0])
    scheduleInputFocus()
  }

  const handleDismiss = () => {
    onClose?.()
  }

  const isDisabled = !name.trim()

  const Container = inline ? InlineSheetContent : Sheet
  return (
    <Container
      ref={sheetRef}
      onDismiss={handleDismiss}
      onPresent={handlePresent}
      header={<SheetHeader title={title ?? t('tabs.editGroup')} />}
      footer={props => (
        <SheetFooter {...props}>
          <HStack className="justify-end">
            <Box className="overflow-hidden border-continuous">
              <Button disabled={isDisabled} onPress={handleSave}>
                {t('Sauvegarder')}
              </Button>
            </Box>
          </HStack>
        </SheetFooter>
      )}
    >
      <SheetView className="px-[20px] py-[20px] gap-[20px]">
        <Box className="overflow-hidden border-continuous gap-[8px]">
          <Text className="text-tertiary text-[13px]">{t('Nom')}</Text>
          <StyledTextInput
            ref={inputRef}
            placeholder={t('tabs.groupNamePlaceholder')}
            placeholderTextColor={theme.colors.grey}
            onChangeText={setName}
            onSubmitEditing={handleSave}
            returnKeyType="send"
            value={name}
            selectTextOnFocus
          />
        </Box>

        <Box className="overflow-hidden border-continuous gap-[8px]">
          <Text className="text-tertiary text-[13px]">{t('Couleur')}</Text>
          <HStack
            className={
              inline
                ? 'gap-[8px] items-center flex-wrap'
                : 'gap-[12px] items-center justify-between'
            }
          >
            {GROUP_COLORS.map((color, index) => (
              <TouchableBox
                className="overflow-hidden border-continuous w-[32px] h-[32px] rounded-[16px] items-center justify-center"
                key={color}
                onPress={() => setSelectedColor(color)}
                accessibilityRole="radio"
                accessibilityLabel={t('accessibility.colorOption', { index: index + 1 })}
                accessibilityState={{ checked: selectedColor === color }}
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <Box className="overflow-hidden border-continuous w-[12px] h-[12px] rounded-[6px] bg-[black] opacity-[0.5]" />
                )}
              </TouchableBox>
            ))}
          </HStack>
        </Box>
      </SheetView>
    </Container>
  )
}

export default EditGroupModal
