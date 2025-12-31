import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { GROUP_COLORS } from '../../../state/tabs'

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface EditGroupModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  initialName?: string
  initialColor?: string
  onSave: (data: { name: string; color: string }) => void
  onClose?: () => void
}

const EditGroupModal = ({
  bottomSheetRef,
  initialName = '',
  initialColor = GROUP_COLORS[0],
  onSave,
  onClose,
}: EditGroupModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState(initialName)
  const [selectedColor, setSelectedColor] = useState(initialColor)

  useEffect(() => {
    setName(initialName)
    setSelectedColor(initialColor || GROUP_COLORS[0])
  }, [initialName, initialColor])

  const handleClose = () => {
    bottomSheetRef.current?.dismiss()
    onClose?.()
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color: selectedColor })
    handleClose()
  }

  const handleSheetChange = (index: number) => {
    if (index >= 0) {
      setName(initialName)
      setSelectedColor(initialColor || GROUP_COLORS[0])
    }
  }

  const isDisabled = !name.trim()

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={handleClose}
      onChange={handleSheetChange}
      topInset={insets.top}
      enableDynamicSizing
      headerComponent={<ModalHeader title={t('tabs.editGroup')} />}
      footerComponent={props => (
        <BottomSheetFooter {...props}>
          <HStack
            py={5}
            px={20}
            justifyContent="flex-end"
            paddingBottom={insets.bottom + 5}
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
      <Box paddingHorizontal={20} py={20} gap={20}>
        <Box gap={8}>
          <Text color="tertiary" fontSize={13}>
            {t('Nom')}
          </Text>
          <StyledTextInput
            placeholder={t('tabs.groupNamePlaceholder')}
            placeholderTextColor={theme.colors.border}
            onChangeText={setName}
            onSubmitEditing={handleSave}
            returnKeyType="send"
            value={name}
            autoFocus
            selectTextOnFocus
          />
        </Box>

        <Box gap={8}>
          <Text color="tertiary" fontSize={13}>
            {t('Couleur')}
          </Text>
          <HStack gap={12} alignItems="center" justifyContent="space-between">
            {GROUP_COLORS.map(color => (
              <TouchableBox
                key={color}
                onPress={() => setSelectedColor(color)}
                width={20}
                height={20}
                borderRadius={10}
                center
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <Box width={12} height={12} borderRadius={6} bg="black" opacity={0.5} />
                )}
              </TouchableBox>
            ))}
          </HStack>
        </Box>
      </Box>
    </Modal.Body>
  )
}

export default EditGroupModal
