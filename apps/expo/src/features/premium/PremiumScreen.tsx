import { format } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, StyleSheet } from 'react-native'

import Header from '~common/Header'
import Link from '~common/Link'
import Box, { HStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { assistantAccessible } from '~features/study-assistant/assistantConfig'
import { ASSISTANT_PATH } from '~features/study-assistant/assistantSheetContext'
import type { StrobiAnimation } from '~features/study-assistant/StrobiAvatar'
import { useStrobiReaction } from '~features/study-assistant/useStrobiReaction'
import { getDateLocale } from '~helpers/languageUtils'
import { toast } from '~helpers/toast'
import useLanguage from '~helpers/useLanguage'
import useLogin from '~helpers/useLogin'

import PlanCard from './PlanCard'
import PremiumHero from './PremiumHero'
import PremiumWelcome from './PremiumWelcome'
import type { PremiumOffer, PremiumOfferPlan } from './premiumOffer'
import { premiumStatusAtom, type PremiumStore } from './premiumStatus'
import {
  buyPremium,
  isPurchasesAvailable,
  loadPremiumOffer,
  restorePremium,
} from './purchasesClient'
import { salesChannel } from './salesChannel'

type PlanChoice = 'annual' | 'monthly'

const STORE_LABELS: Record<PremiumStore, string> = {
  APP_STORE: 'App Store',
  MAC_APP_STORE: 'App Store',
  PLAY_STORE: 'Google Play',
  STRIPE: 'bible-strong.app',
  PROMOTIONAL: 'Bible Strong',
  TEST_STORE: 'Test Store',
  OTHER: 'Bible Strong',
}

const tapHaptic = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync()
}

/**
 * The offer of Premium (ADR-0110): Strobi at its head, what it brings, the plans of this
 * surface's sales channel with the button kept at the bottom of the screen, and, for a reader
 * who holds it, where it is managed. It sells only to a signed-in account. Strobi follows what
 * the reader does: he is proud of the annual plan, thinks while the store sheet is up, is sad
 * when it is closed, and celebrates on the welcome screen once Premium starts.
 */
const PremiumScreen = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const router = useRouter()
  // Opened from the assistant's limit card: the assistant is just below this page.
  const { from } = useLocalSearchParams<{ from?: string }>()
  const { isLogged, user } = useLogin()
  const status = useAtomValue(premiumStatusAtom)
  const channel = salesChannel()
  const canSell = channel !== 'none' && isPurchasesAvailable()

  const [offer, setOffer] = useState<PremiumOffer | null>(null)
  const [offerFailed, setOfferFailed] = useState(false)
  const [choice, setChoice] = useState<PlanChoice>('annual')
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null)
  const [welcome, setWelcome] = useState(false)

  const active = status.kind === 'active'
  const resting: StrobiAnimation = active
    ? 'happy'
    : !isLogged
      ? 'curious'
      : busy === 'buy'
        ? 'thinking'
        : 'idle'
  const [strobi, react] = useStrobiReaction(resting, { animation: 'excited', ms: 1800 })

  const wantsOffer = canSell && isLogged && status.kind === 'none'
  useEffect(() => {
    if (!wantsOffer) return
    let cancelled = false
    setOfferFailed(false)
    loadPremiumOffer()
      .then(loaded => {
        if (cancelled) return
        setOffer(loaded)
        if (!loaded.annual && loaded.monthly) setChoice('monthly')
      })
      .catch(error => {
        console.warn('[Premium] Offer not loaded', error)
        if (!cancelled) setOfferFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [wantsOffer])

  const selectedPlan: PremiumOfferPlan | undefined =
    choice === 'annual' ? (offer?.annual ?? offer?.monthly) : (offer?.monthly ?? offer?.annual)

  const choose = (plan: PlanChoice) => {
    tapHaptic()
    setChoice(plan)
    react(plan === 'annual' ? 'proud' : 'curious', 1400)
  }

  const subscribe = async () => {
    if (!selectedPlan || busy) return
    setBusy('buy')
    try {
      const result = await buyPremium(selectedPlan)
      if (result === 'purchased') setWelcome(true)
      if (result === 'pending') {
        toast.info(t('premiumPlan.pending'))
        react('curious')
      }
      if (result === 'cancelled') react('sad', 1800)
    } catch (error) {
      console.warn('[Premium] Purchase failed', error)
      toast.error(t('premiumPlan.purchaseFailed'))
      react('confused', 1800)
    } finally {
      setBusy(null)
    }
  }

  const restore = async () => {
    if (busy) return
    setBusy('restore')
    try {
      const restored = await restorePremium()
      if (restored.kind === 'active') {
        toast.success(t('premiumPlan.restored'))
        react('celebrate', 2400)
      } else {
        toast.info(t('premiumPlan.nothingToRestore'))
        react('shy')
      }
    } catch (error) {
      console.warn('[Premium] Restore failed', error)
      toast.error(t('premiumPlan.restoreFailed'))
      react('confused')
    } finally {
      setBusy(null)
    }
  }

  const formatDate = (iso: string) =>
    format(new Date(iso), 'd MMMM yyyy', { locale: getDateLocale(lang) })

  const storeName = channel === 'play_store' ? 'Google Play' : 'App Store'
  const termsUrl =
    lang === 'fr' ? 'https://bible-strong.app/eula' : 'https://bible-strong.app/eula-en'
  const privacyUrl =
    lang === 'fr'
      ? 'https://bible-strong.app/politique-de-confidentialite'
      : 'https://bible-strong.app/privacy-policy'

  const offerReady =
    !active && isLogged && canSell && !!offer && !!(offer.annual || offer.monthly) && !offerFailed
  const canAsk = assistantAccessible(user?.id)

  const benefits = (
    <ListSection title={t('premiumPlan.includes')}>
      <ListRow
        icon={<FeatherIcon name="message-circle" size={18} color="primary" />}
        iconTint="primary"
        label={t('premiumPlan.benefit.assistant')}
        hasChevron={false}
      />
      <ListRow
        icon={<FeatherIcon name="smartphone" size={18} color="quint" />}
        iconTint="quint"
        label={t('premiumPlan.benefit.everywhere')}
        hasChevron={false}
      />
      <ListRow
        icon={<FeatherIcon name="heart" size={18} color="color2" />}
        iconTint="color2"
        label={t('premiumPlan.benefit.support')}
        hasChevron={false}
      />
    </ListSection>
  )

  const note = (key: string) => (
    <Box className="px-[24px] mb-[22px]">
      <Text className="text-[15px] leading-[21px] text-grey text-center">{t(key)}</Text>
    </Box>
  )

  const renderPurchase = () => {
    if (active) {
      const until = status.expiresAt
        ? t(status.willRenew ? 'premiumPlan.renewsOn' : 'premiumPlan.endsOn', {
            date: formatDate(status.expiresAt),
          })
        : undefined
      return (
        <ListSection title={t('premiumPlan.yours')}>
          <ListRow
            icon={<FeatherIcon name="check" size={18} color="success" />}
            iconTint="success"
            label={t('premiumPlan.active')}
            description={until}
            hasChevron={false}
          />
          {status.managementURL ? (
            <ListRow
              href={status.managementURL}
              icon={<FeatherIcon name="settings" size={18} color="grey" />}
              label={t('premiumPlan.manage')}
              description={t('premiumPlan.boughtOn', { store: STORE_LABELS[status.store] })}
            />
          ) : null}
        </ListSection>
      )
    }

    if (!isLogged) {
      return (
        <ListSection footer={t('premiumPlan.accountNeeded')}>
          <ListRow
            route="Login"
            icon={<FeatherIcon name="log-in" size={18} color="primary" />}
            iconTint="primary"
            label={t('premiumPlan.signInToSubscribe')}
          />
        </ListSection>
      )
    }

    if (!canSell) return note('premiumPlan.notSoldHere')
    if (offerFailed || (offer && !offer.annual && !offer.monthly)) {
      return note('premiumPlan.offerUnavailable')
    }
    if (status.kind === 'unknown' || !offer) {
      return (
        <Box className="items-center py-[24px]">
          <ActivityIndicator />
        </Box>
      )
    }

    return (
      <Box className="px-[20px] mb-[24px] gap-[10px]">
        <Text className="text-[13px] text-grey mx-[4px]">{t('premiumPlan.choosePlan')}</Text>
        {offer.annual ? (
          <PlanCard
            name={t('premiumPlan.annualName')}
            price={offer.annual.priceString}
            period={t('premiumPlan.perYear')}
            detail={
              offer.annual.pricePerMonthString
                ? t('premiumPlan.perMonth', { price: offer.annual.pricePerMonthString })
                : undefined
            }
            badge={
              offer.savingsPercent
                ? t('premiumPlan.savings', { percent: offer.savingsPercent })
                : undefined
            }
            selected={selectedPlan === offer.annual}
            onPress={() => choose('annual')}
          />
        ) : null}
        {offer.monthly ? (
          <PlanCard
            name={t('premiumPlan.monthlyName')}
            price={offer.monthly.priceString}
            period={t('premiumPlan.perMonthUnit')}
            selected={selectedPlan === offer.monthly}
            onPress={() => choose('monthly')}
          />
        ) : null}
        <Text className="text-[12px] leading-[17px] text-grey mx-[4px] mt-[2px]">
          {t('premiumPlan.renewalTerms', { store: storeName })}
        </Text>
      </Box>
    )
  }

  return (
    <Container className="bg-canvas" reserveBottom={offerReady}>
      <Header hasBackButton />
      <ScrollView backgroundColor="canvas">
        <PremiumHero
          animation={strobi}
          title={t('premiumPlan.headline')}
          pitch={t(active ? 'premiumPlan.activePitch' : 'premiumPlan.pitch')}
          onPet={() => react('laughing')}
        />

        {/* The plans come under Strobi; what Premium brings follows them. */}
        {renderPurchase()}
        {benefits}

        {offerReady ? null : (
          <ListSection>
            {canSell && isLogged && !active ? (
              <ListRow
                onPress={restore}
                disabled={busy !== null}
                icon={<FeatherIcon name="rotate-ccw" size={18} color="grey" />}
                label={t('premiumPlan.restore')}
                trailing={busy === 'restore' ? <ActivityIndicator /> : undefined}
              />
            ) : null}
            <ListRow
              href={termsUrl}
              icon={<FeatherIcon name="file-text" size={18} color="grey" />}
              label={t("Conditions d'utilisation")}
            />
            <ListRow
              href={privacyUrl}
              icon={<FeatherIcon name="shield" size={18} color="grey" />}
              label={t('Politique de confidentialité')}
            />
          </ListSection>
        )}
      </ScrollView>

      {offerReady ? (
        <Box
          className="bg-canvas border-separator px-[20px] pt-[12px] pb-[8px]"
          style={{ borderTopWidth: StyleSheet.hairlineWidth }}
        >
          <Button
            fullWidth
            onPress={subscribe}
            isLoading={busy === 'buy'}
            disabled={!selectedPlan || busy !== null}
          >
            {t('premiumPlan.subscribe')}
          </Button>
          <Text className="text-[12px] leading-[16px] text-grey text-center mt-[8px]">
            {t('premiumPlan.renewalShort', { store: storeName })}
          </Text>
          <HStack className="justify-center items-center gap-[14px] mt-[6px]">
            <Link onPress={restore} disabled={busy !== null}>
              <Text className="text-[13px] text-link font-semibold">
                {t('premiumPlan.restoreShort')}
              </Text>
            </Link>
            <Text className="text-[13px] text-grey">·</Text>
            <Link href={termsUrl}>
              <Text className="text-[13px] text-link">{t('premiumPlan.termsShort')}</Text>
            </Link>
            <Text className="text-[13px] text-grey">·</Text>
            <Link href={privacyUrl}>
              <Text className="text-[13px] text-link">{t('premiumPlan.privacyShort')}</Text>
            </Link>
          </HStack>
        </Box>
      ) : null}

      <PremiumWelcome
        visible={welcome}
        onAsk={
          canAsk
            ? () => {
                setWelcome(false)
                if (from === 'assistant' && router.canGoBack()) router.back()
                else router.push(ASSISTANT_PATH)
              }
            : undefined
        }
        onClose={() => setWelcome(false)}
      />
    </Container>
  )
}

export default PremiumScreen
