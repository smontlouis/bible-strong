import styled from '@emotion/native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { VStack, HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import FireAuth from '~helpers/FireAuth'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'

type ChangePasswordModalProps = {
  modalRef: React.RefObject<BottomSheetModal | null>
}

const ChangePasswordModal = ({ modalRef }: ChangePasswordModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrentPassword(false)
    setShowNewPassword(false)
  }

  const handleClose = () => {
    resetForm()
    modalRef.current?.dismiss()
  }

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return
    }

    if (newPassword !== confirmPassword) {
      return
    }

    if (newPassword.length < 6) {
      return
    }

    setIsLoading(true)
    const success = await FireAuth.changePassword(currentPassword, newPassword)
    setIsLoading(false)

    if (success) {
      handleClose()
    }
  }

  const isValid =
    currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword

  return (
    <Modal.Body
      ref={modalRef}
      enableDynamicSizing
      onModalClose={resetForm}
      headerComponent={<ModalHeader title={t('profile.changePassword')} />}
      footerComponent={props => (
        <BottomSheetFooter bottomInset={insets.bottom} {...props}>
          <HStack px={20} gap={10} justifyContent="flex-end" bg="reverse">
            <Box h={MODAL_FOOTER_HEIGHT}>
              <Button reverse onPress={handleClose} disabled={isLoading}>
                {t('Annuler')}
              </Button>
            </Box>
            <Box h={MODAL_FOOTER_HEIGHT}>
              <Button onPress={handleSubmit} disabled={!isValid || isLoading}>
                {isLoading ? <ActivityIndicator color="white" size="small" /> : t('Enregistrer')}
              </Button>
            </Box>
          </HStack>
        </BottomSheetFooter>
      )}
    >
      <VStack gap={15} paddingHorizontal={20} py={20}>
        <Box>
          <StyledInput
            placeholder={t('profile.currentPassword')}
            placeholderTextColor={theme.colors.grey}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
          />
          <TogglePasswordButton onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
            <FeatherIcon name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color="grey" />
          </TogglePasswordButton>
        </Box>

        <Box>
          <StyledInput
            placeholder={t('profile.newPassword')}
            placeholderTextColor={theme.colors.grey}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
          />
          <TogglePasswordButton onPress={() => setShowNewPassword(!showNewPassword)}>
            <FeatherIcon name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="grey" />
          </TogglePasswordButton>
        </Box>

        {newPassword.length > 0 && newPassword.length < 6 && (
          <Text fontSize={12} color="quart">
            {t('profile.passwordMinLength')}
          </Text>
        )}

        <StyledInput
          placeholder={t('profile.confirmPassword')}
          placeholderTextColor={theme.colors.grey}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showNewPassword}
          autoCapitalize="none"
        />

        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text fontSize={12} color="quart">
            {t('profile.passwordMismatch')}
          </Text>
        )}
      </VStack>
    </Modal.Body>
  )
}

const StyledInput = styled(BottomSheetTextInput)(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  borderRadius: 10,
  paddingHorizontal: 15,
  paddingVertical: 14,
  paddingRight: 50,
  fontSize: 16,
  color: theme.colors.default,
}))

const TogglePasswordButton = styled.TouchableOpacity({
  position: 'absolute',
  right: 15,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
})

export default ChangePasswordModal
