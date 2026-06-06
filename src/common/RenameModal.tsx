import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetTextInput,
  SheetView,
  type SheetRef,
} from '~common/sheet'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput as RNTextInput } from 'react-native'
import Button from '~common/ui/Button'

const StyledTextInput = styled(SheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface RenameModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  title: string
  placeholder: string
  initialValue?: string
  onSave: (value: string) => void
  onClose?: () => void
}

const RenameModal = ({
  sheetRef,
  title,
  placeholder,
  initialValue = '',
  onSave,
  onClose,
}: RenameModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const [value, setValue] = useState(initialValue)
  const inputRef = React.useRef<RNTextInput>(null)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const scheduleInputFocus = () => {
    inputRef.current?.focus()
  }

  const handleClose = () => {
    sheetRef.current?.dismiss()
  }

  const handleSave = () => {
    if (!value.trim()) return
    onSave(value.trim())
    handleClose()
  }

  const handlePresent = () => {
    setValue(initialValue)
    scheduleInputFocus()
  }

  const handleDismiss = () => {
    onClose?.()
  }

  const isDisabled = !value.trim()

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={handleDismiss}
      onPresent={handlePresent}
      header={<SheetHeader title={title} />}
      footer={props => (
        <SheetFooter {...props}>
          <Button disabled={isDisabled} onPress={handleSave}>
            {t('Sauvegarder')}
          </Button>
        </SheetFooter>
      )}
    >
      <SheetView px={20} py={20}>
        <StyledTextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.grey}
          onChangeText={setValue}
          onSubmitEditing={handleSave}
          returnKeyType="send"
          value={value}
          selectTextOnFocus
        />
      </SheetView>
    </Sheet>
  )
}

export default RenameModal
