import React from 'react'

import { Trans, useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import Header from '~common/Header'
import InlineLink from '~common/InlineLink'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { subSkus, useInitIAP } from '~helpers/useInAppPurchases'
import useLogin from '~helpers/useLogin'
import { useIsPremium } from '~helpers/usePremium'
import SubscriptionGroup from './SubscriptionGroup'
import { subVariant } from './SubscriptionPlan'

export const [oneMonthSkuMin, oneMonthSku, oneMonthSkuMax] = subSkus
export const mappingSku = {
  [oneMonthSkuMin]: {
    variant: 'normal' as subVariant,
  },
  [oneMonthSku]: {
    variant: 'primary' as subVariant,
  },
  [oneMonthSkuMax]: {
    variant: 'normal' as subVariant,
  },
}

const PremiumScreen = () => {
  const hasPremium = useIsPremium()
  const { isLogged } = useLogin()
  const { t } = useTranslation()
  useInitIAP()

  if (hasPremium) {
    return (
      <Container>
        <Header hasBackButton />
        <ScrollView>
          <Box p={20} mb={40}>
            <Text fontSize={30} title>
              {t('Merci de nous soutenir !')}
            </Text>
            <Box mt={20}>
              <Paragraph scale={-1} fontFamily="text">
                {t('premium.description')}
              </Paragraph>
            </Box>
            <LinkBox
              mt={30}
              onPress={() =>
                Linking.openURL(
                  Platform.OS === 'android'
                    ? 'https://play.google.com/store/account/subscriptions'
                    : 'https://apps.apple.com/account/subscriptions'
                )
              }
            >
              <Text color="quart" textAlign="center">
                {t("Annuler l'abonnement")}
              </Text>
            </LinkBox>
          </Box>
        </ScrollView>
      </Container>
    )
  }

  return (
    <Container>
      <Header hasBackButton />
      <ScrollView>
        <Box p={20} mb={40}>
          <Text fontSize={30} title>
            {t("Soutenez l'application, Devenez un sponsor !")}
          </Text>
          <Box mt={20}>
            <Paragraph scale={-1} fontFamily="text">
              <Trans>
                Merci de nous soutenir ! L'objectif de Bible Strong est de créer{' '}
                <Text bold>un outil complet d'études bibliques</Text> répondant
                à vos besoins, tout en vous proposant une expérience
                exceptionnelle.
                {'\n\n'}Je souhaite donner l'opportunité à chacun de pouvoir
                s'impliquer dans l'évolution de l'application, en vous proposant
                un <Text bold>système de prix libre</Text> que vous choisissez
                et que vous estimez juste, afin de <Text bold>sponsoriser</Text>{' '}
                l'application.
              </Trans>
            </Paragraph>
            <Box mt={20} />
            <Paragraph scale={-1} fontFamily="text">
              {t('app.whatIsASponsor')}
            </Paragraph>
          </Box>
          <Paragraph scale={-1} fontFamily="text">
            {t(
              'Tous les abonnements se renouvellent mensuellement de façon automatique. Vous avez la possibilité de les annuler quand vous le souhaitez.'
            )}
          </Paragraph>
          <Paragraph scale={-1} fontFamily="text" mt={10}>
            <Trans>
              Vous pouvez également me soutenir par
              <InlineLink href="https://www.paypal.me/smontlouis">
                {' '}
                paypal{' '}
              </InlineLink>{' '}
              ou{' '}
              <InlineLink href="https://fr.tipeee.com/smontlouis">
                virement
              </InlineLink>{' '}
              pour devenir un sponsor. {'\n'}Merci de votre confiance et bonne
              étude !
            </Trans>
          </Paragraph>
        </Box>
        {!isLogged ? (
          <Box px={40}>
            <Text textAlign="center" color="quart">
              {t(
                "Vous devez être enregistré pour accéder à l'offre d'abonnement."
              )}
            </Text>
          </Box>
        ) : (
          <SubscriptionGroup />
        )}
      </ScrollView>
    </Container>
  )
}

export default PremiumScreen
