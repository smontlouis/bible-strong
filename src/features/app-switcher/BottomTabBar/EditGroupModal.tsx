import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { SheetFooter, Sheet, SheetTextInput, type SheetRef } from '~common/sheet'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { GROUP_COLORS } from '../../../state/tabs'

const StyledTextInput = styled(SheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface EditGroupModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  initialName?: string
  initialColor?: string
  onSave: (data: { name: string; color: string }) => void
  onClose?: () => void
}

const EditGroupModal = ({
  sheetRef,
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
    sheetRef.current?.dismiss()
    onClose?.()
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color: selectedColor })
    handleClose()
  }

  const handlePresent = () => {
    setName(initialName)
    setSelectedColor(initialColor || GROUP_COLORS[0])
  }

  const isDisabled = !name.trim()

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={handleClose}
      onPresent={handlePresent}
      header={<ModalHeader title={t('tabs.editGroup')} />}
      footer={props => (
        <SheetFooter {...props}>
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
        </SheetFooter>
      )}
    >
      <Box paddingHorizontal={20} py={20} gap={20}>
        <Box gap={8}>
          <Text color="tertiary" fontSize={13}>
            {t('Nom')}
          </Text>
          <StyledTextInput
            placeholder={t('tabs.groupNamePlaceholder')}
            placeholderTextColor={theme.colors.grey}
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
    </Sheet>
  )
}

export default EditGroupModal
