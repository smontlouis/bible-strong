import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { isPurchasesAvailable } from '~features/premium/purchasesClient'
import { salesChannel } from '~features/premium/salesChannel'
import useLanguage from '~helpers/useLanguage'

import { useAssistantSheet } from './assistantSheetContext'
import { quotaReturn } from './assistantQuota'
import { useAssistantQuota } from './useAssistantQuota'
import StrobiAvatar from './StrobiAvatar'
import { useStrobiReaction } from './useStrobiReaction'

/**
 * The daily quota is used up: Strobi grows drowsy and falls asleep until the questions come
 * back, at the hour said in the reader's own time. Where Premium is sold, it is offered here,
 * the one place where its value is plain.
 */
export default function AssistantLimitCard() {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { navigate } = useAssistantSheet()
  const premium = useAtomValue(premiumStatusAtom)
  // The sentence names the account's daily questions once the service has said how many.
  const quota = useAssistantQuota()
  const [now] = useState(() => new Date())
  const { key, time, count } = quotaReturn(
    now,
    lang,
    quota?.kind === 'daily' ? quota.limit : undefined
  )
  const [animation] = useStrobiReaction('sleeping', { animation: 'drowsy', ms: 2800 })
  const offersPremium =
    premium.kind === 'none' && salesChannel() !== 'none' && isPurchasesAvailable()
  return (
    <Box
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-light-grey my-3 items-center rounded-[12px] px-5 pb-5 pt-3"
    >
      <StrobiAvatar animation={animation} size={96} settleAfterMs={5000} />
      <Text className="mt-1 text-center text-[16px] font-semibold">
        {t('assistant.limitCard.title')}
      </Text>
      <Text className="text-grey mt-1 text-center text-[14px] leading-[20px]">
        {t(key, { time, count })}
      </Text>
      {offersPremium ? (
        <>
          <Text className="text-grey mt-3 text-center text-[14px] leading-[20px]">
            {t('assistant.limitCard.premiumHint')}
          </Text>
          <Box className="mt-3 self-stretch">
            <Button
              fullWidth
              onPress={() => navigate({ pathname: '/premium', params: { from: 'assistant' } })}
            >
              {t('assistant.limitCard.premium')}
            </Button>
          </Box>
        </>
      ) : null}
    </Box>
  )
}
