import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface RenameModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  title: string
  placeholder: string
  initialValue?: string
  onSave: (value: string) => void
  onClose?: () => void
}

const RenameModal = ({
  bottomSheetRef,
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
    bottomSheetRef.current?.dismiss()
    onClose?.()
  }

  const handleSave = () => {
    if (!value.trim()) return
    onSave(value.trim())
    handleClose()
  }

  const handleSheetChange = (index: number) => {
    if (index >= 0) {
      setValue(initialValue)
    }
  }

  const isDisabled = !value.trim()

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={handleClose}
      onChange={handleSheetChange}
      topInset={insets.top}
      enableDynamicSizing
      headerComponent={<ModalHeader title={title} />}
      footerComponent={props => (
        <BottomSheetFooter {...props}>
          <HStack
            py={5}
            px={20}
            justifyContent="flex-end"
            paddingBottom={insets.bottom}
            bg="reverse"
          >
            <Box>
              <Button disabled={isDisabled} onPress={handleSave}>
                {t('Sauvegarder')}
              </Button>
            </Box>
          </HStack>
        </BottomSheetFooter>
      )}
    >
      <Box paddingHorizontal={20} paddingTop={20}>
        <StyledTextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.border}
          onChangeText={setValue}
          onSubmitEditing={handleSave}
          returnKeyType="send"
          value={value}
          autoFocus
          selectTextOnFocus
        />
      </Box>
    </Modal.Body>
  )
}

export default RenameModal
