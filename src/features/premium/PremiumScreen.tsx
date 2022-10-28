import React from 'react'

import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import StylizedMarkdown from '~common/StylizedMarkdown'
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
import useLanguage from '~helpers/useLanguage'

const descriptionFr = `Merci de nous soutenir ! L'objectif de Bible Strong est de créer **un outil complet d'études bibliques** répondant à vos besoins, tout en vous proposant une expérience exceptionnelle.

Je souhaite donner l'opportunité à chacun de pouvoir s'impliquer dans l'évolution de l'application, en vous proposant un **système de prix libre** que vous choisissez et que vous estimez juste, afin de **sponsoriser** l'application.

L'application est **totalement gratuite**, mais pour des raisons de coûts, il est nécessaire de limiter l'utilisation des services payants, tels que la traduction de commentaires et les recherches. Le sponsor a un accès illimité à ces contenus.

Tous les abonnements se renouvellent mensuellement de façon automatique. Vous avez la possibilité de les annuler quand vous le souhaitez.

Vous pouvez également me soutenir par [paypal](https://www.paypal.me/smontlouis) ou [virement](https://fr.tipeee.com/smontlouis) pour devenir un sponsor.

Merci de votre confiance et bonne étude !`

const descriptionEn = `Thank you for supporting us! The goal of Bible Strong is to create **a complete Bible study tool** that meets your needs, while providing an exceptional experience.

I want to give everyone the opportunity to be involved in the evolution of the application, by offering a **free pricing system** that you choose and that you feel is right, in order to **sponsor** the application.

The application is **totally free**, but for cost reasons, it is necessary to limit the use of paid services, such as comment translation and searches. The sponsor has unlimited access to this content.

All subscriptions are automatically renewed on a monthly basis. You have the possibility to cancel them whenever you want.

You can also support me by [paypal](https://www.paypal.me/smontlouis) or [bank transfer](https://fr.tipeee.com/smontlouis) to become a sponsor.

Thank you for your trust and good study !`

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
  const isFR = useLanguage()

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
            <StylizedMarkdown>
              {isFR ? descriptionFr : descriptionEn}
            </StylizedMarkdown>
          </Box>
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
