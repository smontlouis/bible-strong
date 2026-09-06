import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { ActivityIndicator } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import type { Theme as AppTheme } from '~themes'

import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'

type EmailVerificationModalProps = {
  modalRef: React.RefObject<SheetRef | null>
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
    await FireAuth.sendEmailVerification().finally(() => setIsSending(false))
  }

  return (
    <Sheet ref={modalRef} header={<SheetHeader title={t('profile.emailNotVerified')} />}>
      <VStack className="overflow-hidden border-continuous gap-[20px] px-[20px] py-[20px]">
        <Box className="overflow-hidden border-continuous flex-row items-center gap-[12px]">
          <WarningIcon>
            <FeatherIcon name="alert-circle" size={24} color="white" />
          </WarningIcon>
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text className="text-[14px] text-default">{t('profile.emailNotVerifiedDesc')}</Text>
          </Box>
        </Box>

        <ResendButton onPress={handleResend} disabled={isSending}>
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-[14px] text-[white] font-bold">
              {t('profile.resendVerification')}
            </Text>
          )}
        </ResendButton>
      </VStack>
    </Sheet>
  )
}

const WarningIcon = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('bg-quart rounded-[20px] p-[8px]', className))
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
}

const ResendButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('py-[12px] px-[20px] bg-primary rounded-[10px] items-center', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

export default EmailVerificationModal
