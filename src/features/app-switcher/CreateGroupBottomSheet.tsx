import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HStack } from '~common/ui/Stack'
import { useCreateGroup, useSwitchGroup } from '../../state/tabGroups'

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface CreateGroupBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  onClose?: () => void
  onGroupCreated?: (groupId: string) => void
}

const CreateGroupBottomSheet = ({
  bottomSheetRef,
  onClose,
  onGroupCreated,
}: CreateGroupBottomSheetProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const createGroup = useCreateGroup()
  const switchGroup = useSwitchGroup()

  const handleClose = () => {
    setName('')
    bottomSheetRef.current?.dismiss()
    onClose?.()
  }

  const handleCreate = () => {
    if (!name.trim()) return

    const newGroupId = createGroup(name.trim())
    if (newGroupId) {
      switchGroup(newGroupId)
      onGroupCreated?.(newGroupId)
    }
    handleClose()
  }

  const handleSheetChange = (index: number) => {
    if (index === -1) {
      setName('')
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
      headerComponent={<ModalHeader title={t('tabs.newGroupTitle')} />}
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
              <Button disabled={isDisabled} onPress={handleCreate}>
                {t('common.create')}
              </Button>
            </Box>
          </HStack>
        </BottomSheetFooter>
      )}
    >
      <Box paddingHorizontal={20} paddingTop={20}>
        <StyledTextInput
          placeholder={t('tabs.groupNamePlaceholder')}
          placeholderTextColor={theme.colors.border}
          onChangeText={setName}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
          value={name}
          autoFocus
          selectTextOnFocus
        />
      </Box>
    </Modal.Body>
  )
}

export default CreateGroupBottomSheet
