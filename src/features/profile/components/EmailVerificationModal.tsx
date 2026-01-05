import styled from '@emotion/native'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import FireAuth from '~helpers/FireAuth'

type EmailVerificationModalProps = {
  modalRef: React.RefObject<BottomSheetModal | null>
}

const EmailVerificationModal = ({ modalRef }: EmailVerificationModalProps) => {
  const { t } = useTranslation()
  const [isSending, setIsSending] = useState(false)

  // Poll for email verification every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      FireAuth.checkEmailVerification()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleResend = async () => {
    setIsSending(true)
    await FireAuth.sendEmailVerification()
    setIsSending(false)
  }

  return (
    <Modal.Body
      ref={modalRef}
      enableDynamicSizing
      headerComponent={<ModalHeader title={t('profile.emailNotVerified')} />}
    >
      <VStack gap={20} paddingHorizontal={20} paddingVertical={20}>
        <Box row alignItems="center" gap={12}>
          <WarningIcon>
            <FeatherIcon name="alert-circle" size={24} color="white" />
          </WarningIcon>
          <Box flex>
            <Text fontSize={14} color="default">
              {t('profile.emailNotVerifiedDesc')}
            </Text>
          </Box>
        </Box>

        <ResendButton onPress={handleResend} disabled={isSending}>
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text fontSize={14} color="white" bold>
              {t('profile.resendVerification')}
            </Text>
          )}
        </ResendButton>
      </VStack>
    </Modal.Body>
  )
}

const WarningIcon = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.quart,
  borderRadius: 20,
  padding: 8,
}))

const ResendButton = styled.TouchableOpacity(({ theme }) => ({
  paddingVertical: 12,
  paddingHorizontal: 20,
  backgroundColor: theme.colors.primary,
  borderRadius: 10,
  alignItems: 'center',
}))

export default EmailVerificationModal
