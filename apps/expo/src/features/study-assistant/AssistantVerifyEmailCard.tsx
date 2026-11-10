import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'

import { useEmailVerificationWatch } from './useAssistantQuota'

/**
 * The free questions wait for a verified address. The card resends the link, and the questions
 * open by themselves once the reader has followed it.
 */
export default function AssistantVerifyEmailCard({ limit }: { limit: number | null }) {
  const { t } = useTranslation()
  const [sending, setSending] = useState(false)
  useEmailVerificationWatch(true)
  return (
    <Box
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-light-grey my-3 rounded-[12px] px-5 pb-5 pt-4"
    >
      <Text className="text-[16px] font-semibold">{t('assistant.verifyCard.title')}</Text>
      <Text className="text-grey mt-1 text-[14px] leading-[20px]">
        {limit ? t('assistant.verifyCard.detail', { count: limit }) : t('assistant.verifyEmail')}
      </Text>
      <Box className="mt-4 self-start">
        <Button
          small
          isLoading={sending}
          disabled={sending}
          onPress={() => {
            setSending(true)
            void FireAuth.sendEmailVerification().finally(() => setSending(false))
          }}
        >
          {t('assistant.verifyCard.resend')}
        </Button>
      </Box>
    </Box>
  )
}
