import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { Sheet, SheetFooter, SheetHeader, SheetTextInput, type SheetRef } from '~common/sheet'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'

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
  const insets = useSafeAreaInsets()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const handleClose = () => {
    sheetRef.current?.dismiss()
  }

  const handleSave = () => {
    if (!value.trim()) return
    onSave(value.trim())
    handleClose()
  }

  const handlePresent = () => setValue(initialValue)

  const isDisabled = !value.trim()

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      onPresent={handlePresent}
      header={<SheetHeader title={title} />}
      footer={props => (
        <SheetFooter bottomInset={insets.bottom} {...props}>
          <HStack py={5} px={20} justifyContent="flex-end" bg="reverse">
            <Box>
              <Button disabled={isDisabled} onPress={handleSave}>
                {t('Sauvegarder')}
              </Button>
            </Box>
          </HStack>
        </SheetFooter>
      )}
    >
      <Box paddingHorizontal={20} py={20}>
        <StyledTextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.grey}
          onChangeText={setValue}
          onSubmitEditing={handleSave}
          returnKeyType="send"
          value={value}
          autoFocus
          selectTextOnFocus
        />
      </Box>
    </Sheet>
  )
}

export default RenameModal
