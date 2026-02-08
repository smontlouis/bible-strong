import styled from '@emotion/native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert } from 'react-native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getAuth, deleteUser } from '@react-native-firebase/auth'

import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { VStack, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import FireAuth from '~helpers/FireAuth'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'

type DeleteAccountModalProps = {
  modalRef: React.RefObject<BottomSheetModal | null>
}

const DeleteAccountModal = ({ modalRef }: DeleteAccountModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const confirmationText = t('app.deleteAccountConfirmationText')
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isValid = confirmText === confirmationText

  const resetForm = () => {
    setConfirmText('')
  }

  const handleClose = () => {
    resetForm()
    modalRef.current?.dismiss()
  }

  const handleDelete = async () => {
    if (!isValid) return

    const authUser = getAuth().currentUser
    if (!authUser) return

    setIsLoading(true)
    try {
      await deleteUser(authUser)
      handleClose()
      FireAuth.logout()
    } catch (error: any) {
      setIsLoading(false)
      console.error('[Auth] Delete error:', error.code, error.message)
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(t('Attention'), t('app.deleteAccountRequiresRecentLogin'))
      } else {
        Alert.alert(t('Erreur'), error.message)
      }
    }
  }

  return (
    <Modal.Body
      ref={modalRef}
      enableDynamicSizing
      onModalClose={resetForm}
      headerComponent={<ModalHeader title={t('app.deleteAccount')} />}
      footerComponent={props => (
        <BottomSheetFooter bottomInset={insets.bottom} {...props}>
          <HStack px={20} gap={10} justifyContent="flex-end" bg="reverse">
            <Box h={MODAL_FOOTER_HEIGHT}>
              <Button reverse onPress={handleClose} disabled={isLoading}>
                {t('Annuler')}
              </Button>
            </Box>
            <Box h={MODAL_FOOTER_HEIGHT}>
              <Button
                color={theme.colors.quart}
                onPress={handleDelete}
                disabled={!isValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  t('app.deleteAccountConfirmButton')
                )}
              </Button>
            </Box>
          </HStack>
        </BottomSheetFooter>
      )}
    >
      <VStack gap={15} paddingHorizontal={20} py={20}>
        <Text fontSize={15}>{t('app.deleteAccountBody')}</Text>
        <Text fontSize={14} color="grey">
          {t('app.deleteAccountTypeConfirm', { text: confirmationText })}
        </Text>
        <StyledInput
          placeholder={confirmationText}
          placeholderTextColor={theme.colors.grey}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </VStack>
    </Modal.Body>
  )
}

const StyledInput = styled(BottomSheetTextInput)(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  borderRadius: 10,
  paddingHorizontal: 15,
  paddingVertical: 14,
  fontSize: 16,
  color: theme.colors.default,
}))

export default DeleteAccountModal
