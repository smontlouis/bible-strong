import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Header from '~common/Header'
import { usePageBottomInset } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { pageContentStyle } from '~common/ui/PageContent'
import ScrollView from '~common/ui/ScrollView'
import Switch from '~common/ui/Switch'
import { premiumStatusAtom } from '~features/premium/premiumStatus'
import { usePremiumVisible } from '~features/premium/premiumVisibility'
import useLogin from '~helpers/useLogin'
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
  const bottomInset = usePageBottomInset()
  // Opened from the conversation, « Ouvrir Strobi » goes back to it. The page is then a sheet over
  // it on iOS (sheetPresentation), which Container lays out.
  const { from } = useLocalSearchParams<{ from?: string }>()
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
  // Given here, the agreement shows its whole text first, as in the conversation (5.1.2(i)).
  const promptGrantAiConsent = async () => {
    const confirmed = await confirm({
      title: t('strobi.settings.consentAskTitle'),
      message: t('assistant.consent.detail'),
      cancelLabel: t('Annuler'),
      confirmLabel: t('assistant.consent.accept'),
    })
    if (confirmed) await aiConsent.accept().catch(() => {})
  }
  const consentGranted = aiConsent.status === 'granted'
  const toggleAiConsent = () =>
    void (consentGranted ? promptWithdrawAiConsent() : promptGrantAiConsent())

  // What is left today, once the service has said it.
  const quotaDetail =
    quota?.kind === 'unlimited'
      ? t('strobi.settings.unlimited')
      : quota?.kind === 'daily'
        ? quota.remaining > 0
          ? t('strobi.settings.remaining', { count: quota.remaining })
          : t('strobi.settings.noneLeft')
        : undefined

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('strobi.settings.title')} />
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
          <ListSection title={t('strobi.settings.display')}>
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

        {/* The agreement to share questions with AI providers, given or taken back (5.1.2(i)):
            each way asks first, and giving it shows its whole text. */}
        {assistantShown && isLogged && aiConsent.status !== 'loading' && (
          <ListSection
            title={t('strobi.settings.data')}
            footer={t('strobi.settings.consentDetail')}
          >
            <ListRow
              icon={<FeatherIcon name="shield" size={18} color="grey" />}
              label={t('assistant.consent.settingsLabel')}
              onPress={toggleAiConsent}
              accessibilityState={{ checked: consentGranted }}
              trailing={
                <Switch
                  accessibilityLabel={t('assistant.consent.settingsLabel')}
                  accessibilityState={{ checked: consentGranted }}
                  // Stays where it is until the reader confirms; the agreement moves it then.
                  value={consentGranted}
                  onValueChange={toggleAiConsent}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  ios_backgroundColor={theme.colors.border}
                  thumbColor="#ffffff"
                />
              }
            />
          </ListSection>
        )}
      </ScrollView>
    </Container>
  )
}
