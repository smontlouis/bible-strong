import { use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'

import { ComposerInsetContext } from './assistantSheetContext'
import { useEmailVerificationWatch } from './useAssistantQuota'

/**
 * The free questions wait for a verified address. The card resends the link, and the questions
 * open by themselves once the reader has followed it.
 *
 * Docked, it takes the composer's place at the bottom of the page: nothing can be asked then.
 */
export default function AssistantVerifyEmailCard({
  limit,
  docked = false,
}: {
  limit: number | null
  docked?: boolean
}) {
  const { t } = useTranslation()
  const [sending, setSending] = useState(false)
  const insets = useSafeAreaInsets()
  const inset = use(ComposerInsetContext)
  useEmailVerificationWatch(true)
  const card = (
    <Box
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`bg-light-grey px-5 pb-5 pt-4 ${docked ? 'rounded-[16px]' : 'my-3 rounded-[12px]'}`}
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
  if (!docked) return card
  return (
    <Box
      className="bg-reverse px-3 pt-1"
      onLayout={event => inset.setHeight(Math.ceil(event.nativeEvent.layout.height))}
      style={{ paddingBottom: insets.bottom + 4 }}
    >
      {card}
    </Box>
  )
}
