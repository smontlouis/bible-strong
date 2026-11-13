import { use } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Link from '~common/Link'
import Box, { HStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { premiumPrivacyUrl } from '~features/premium/premiumConfig'
import useLanguage from '~helpers/useLanguage'
import { ComposerInsetContext, useAssistantSheet } from './assistantSheetContext'

/**
 * In place of the composer until the account agrees to send what it asks to third-party AI
 * providers (App Store rule 5.1.2(i)). Declining closes the assistant; it asks again next time.
 */
export default function AssistantConsentCard() {
  const { t } = useTranslation()
  const lang = useLanguage()
  const { session, close } = useAssistantSheet()
  const insets = useSafeAreaInsets()
  const inset = use(ComposerInsetContext)
  return (
    <Box
      className="bg-reverse px-3 pt-1"
      onLayout={event => inset.setHeight(Math.ceil(event.nativeEvent.layout.height))}
      style={{ paddingBottom: insets.bottom + 4 }}
    >
      <Box accessibilityRole="summary" className="bg-light-grey rounded-[16px] px-5 pb-4 pt-4">
        <Text accessibilityRole="header" className="text-[16px] font-semibold">
          {t('assistant.consent.title')}
        </Text>
        <Text className="text-grey mt-1 text-[14px] leading-[20px]">
          {t('assistant.consent.detail')}
        </Text>
        <Link href={premiumPrivacyUrl(lang)} className="mt-2 self-start">
          <Text className="text-link text-[14px]">{t('Politique de confidentialité')}</Text>
        </Link>
        <HStack className="mt-4 items-center gap-2">
          <Box className="flex-1">
            <Button
              fullWidth
              // The composer shows at once; a write the server refuses brings the card back.
              onPress={() => void session.consent.accept().catch(() => {})}
            >
              {t('assistant.consent.accept')}
            </Button>
          </Box>
          <Box className="flex-1">
            <Button fullWidth secondary onPress={close}>
              {t('assistant.consent.decline')}
            </Button>
          </Box>
        </HStack>
      </Box>
    </Box>
  )
}
