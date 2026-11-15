import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Header from '~common/Header'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { pageContentStyle } from '~common/ui/PageContent'
import ScrollView from '~common/ui/ScrollView'
import Switch from '~common/ui/Switch'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { usePremiumVisible } from '~features/premium/premiumVisibility'
import { IS_FORM_SHEET } from '~helpers/constants'
import useLogin from '~helpers/useLogin'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
import { useTheme } from '~themes/ThemeProvider'
import { useAiConsent } from './aiConsent'
import { useAssistantAccessible } from './assistantConfig'
import { returnToAssistant } from './returnToAssistant'
import StrobiAvatar from './StrobiAvatar'
import { useStrobiBubble } from './strobiBubble'
import { useAssistantQuota } from './useAssistantQuota'

/**
 * Everything about Strobi in one place: opening it, its subscription, its floating bubble and
 * what it shares with AI providers. It is also where the bubble comes back from once put away.
 */
export default function StrobiSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useTheme()
  const confirm = useConfirmDialog()
  const pageBottomInset = usePageBottomInset()
  const insets = useSafeAreaInsets()
  const { from } = useLocalSearchParams<{ from?: string }>()
  // Opened from the conversation, the page is a sheet over it on iOS (FullAppRuntime): no room
  // for the status bar, and going back shows the conversation again.
  const sheet = IS_FORM_SHEET && from === 'assistant'
  const bottomInset = sheet ? insets.bottom : pageBottomInset
  const { isLogged, user } = useLogin()
  const account = isLogged ? user.id : null
  const assistantShown = useAssistantAccessible(account)
  // On the phone and the tablet the assistant needs an account; the Web also answers guests.
  const canOpen = assistantShown && (isLogged || Platform.OS === 'web')
  const premiumVisible = usePremiumVisible()
  const premium = useAtomValue(premiumStatusAtom)
  const quota = useAssistantQuota()
  const bubble = useStrobiBubble()
  const aiConsent = useAiConsent(assistantShown ? account : null)

  const promptWithdrawAiConsent = async () => {
    const confirmed = await confirm({
      title: t('assistant.consent.withdrawTitle'),
      message: t('assistant.consent.withdrawDetail'),
      cancelLabel: t('Non'),
      confirmLabel: t('assistant.consent.withdraw'),
      destructive: true,
    })
    if (confirmed) await aiConsent.withdraw().catch(() => {})
  }

  // What is left today, once the service has said it.
  const quotaDetail =
    quota?.kind === 'unlimited'
      ? t('strobi.settings.unlimited')
      : quota?.kind === 'daily'
        ? quota.remaining > 0
          ? t('strobi.settings.remaining', { count: quota.remaining })
          : t('strobi.settings.noneLeft')
        : undefined

  const content = (
    <>
      <Header hasBackButton title={t('strobi.settings.title')} />
      {/* In a sheet, iOS stretches a bare scroll view over the whole sheet, header included. */}
      <Box className="flex-1 overflow-hidden">
        <ScrollView
          backgroundColor="canvas"
          contentContainerStyle={[
            pageContentStyle,
            { paddingTop: 20, paddingBottom: 20 + bottomInset },
          ]}
        >
          {canOpen && (
            <ListSection>
              <ListRow
                onPress={() => returnToAssistant(router, from)}
                // Strobi holds still facing the reader. Not `curious`: it settles with its head turned.
                icon={<StrobiAvatar animation="idle" size={36} settleAfterMs={2600} />}
                iconBg="transparent"
                label={t('strobi.settings.open')}
                description={quotaDetail}
              />
            </ListSection>
          )}

          {premiumVisible && (
            <ListSection title={t('strobi.settings.subscription')}>
              <ListRow
                route="Premium"
                icon={<FeatherIcon name="star" size={18} color="primary" />}
                iconTint="primary"
                label={t('premiumPlan.headline')}
                description={
                  premium.kind === 'active'
                    ? t('premiumPlan.active')
                    : t('premiumPlan.benefit.assistant')
                }
              />
            </ListSection>
          )}

          {assistantShown && (
            <ListSection
              title={t('strobi.settings.display')}
              footer={t(
                Platform.OS === 'web'
                  ? 'strobi.settings.bubbleFooterWeb'
                  : 'strobi.settings.bubbleFooter'
              )}
            >
              <ListRow
                icon={<FeatherIcon name="message-circle" size={18} color="grey" />}
                label={t('strobi.settings.showBubble')}
                onPress={() => bubble.setHidden(!bubble.hidden)}
                accessibilityState={{ checked: !bubble.hidden }}
                trailing={
                  <Switch
                    accessibilityLabel={t('strobi.settings.showBubble')}
                    accessibilityState={{ checked: !bubble.hidden }}
                    value={!bubble.hidden}
                    onValueChange={value => bubble.setHidden(!value)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    ios_backgroundColor={theme.colors.border}
                    thumbColor="#ffffff"
                  />
                }
              />
            </ListSection>
          )}

          {/* The agreement to share questions with AI providers can be taken back here (5.1.2(i)).
            It is given only in the conversation, where its whole text is shown. */}
          {assistantShown && isLogged && aiConsent.status !== 'loading' && (
            <ListSection title={t('strobi.settings.data')}>
              {aiConsent.status === 'granted' ? (
                <ListRow
                  onPress={promptWithdrawAiConsent}
                  icon={<FeatherIcon name="shield" size={18} color="grey" />}
                  label={t('assistant.consent.settingsLabel')}
                  description={t('assistant.consent.settingsDetail')}
                />
              ) : (
                <ListRow
                  disabled
                  icon={<FeatherIcon name="shield" size={18} color="grey" />}
                  label={t('assistant.consent.settingsLabel')}
                  description={t('strobi.settings.consentMissing')}
                  hasChevron={false}
                />
              )}
            </ListSection>
          )}
        </ScrollView>
      </Box>
    </>
  )
  return sheet ? (
    <ModalRouteFrame>
      <Box className="bg-canvas flex-1" style={{ paddingTop: 8 }}>
        {content}
      </Box>
    </ModalRouteFrame>
  ) : (
    <Container className="bg-canvas">{content}</Container>
  )
}
