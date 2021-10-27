import React from 'react'

import Text from '~common/ui/Text'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import { FeatherIcon } from '~common/ui/Icon'
import { Linking, Platform } from 'react-native'
import { subVariant } from './SubscriptionPlan'
import { subSkus, useInitIAP } from '~helpers/useInAppPurchases'
import SubscriptionGroup from './SubscriptionGroup'
import { useIsPremium } from '~helpers/usePremium'
import { LinkBox } from '~common/Link'
import ScrollView from '~common/ui/ScrollView'
import useLogin from '~helpers/useLogin'
import Paragraph from '~common/ui/Paragraph'
import { useTranslation, Trans } from 'react-i18next'

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

const ListItem = ({ children }: { children: React.ReactNode }) => (
  <Box row pb={20} lightShadow>
    <FeatherIcon name="check" size={25} color="success" />
    <Text flex wrap marginLeft={20} fontSize={16}>
      {children}
    </Text>
  </Box>
)

const PremiumScreen = () => {
  const hasPremium = useIsPremium()
  const { isLogged } = useLogin()
  const { t, i18n } = useTranslation()
  useInitIAP()

  const isFR = i18n.language === 'fr'

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
                {t(
                  'Vous êtes actuellement abonné à Bible Strong premium. Vous avez accès aux fonctionnalités suivantes'
                )}
              </Paragraph>
            </Box>
            <Box mt={30}>
              {isFR && <ListItem>{t('Accès aux commentaires')}</ListItem>}
              <ListItem>{t('Accès aux études sur le web')}</ListItem>
              <ListItem>{t("...Et plein d'autres à venir")}</ListItem>
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
                Merci de me soutenir ! L'objectif de Bible Strong est de créer{' '}
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
              {t(
                "Qu'est-ce qu'un sponsor ? C'est un donateur qui soutient l'application et qui a accès aux nouvelles fonctionnalités en priorité. Ces nouvelles fonctionnalités sont ensuite disponibles aux grand public après un certain délai."
              )}{' '}
            </Paragraph>
          </Box>
          <Box mt={30}>
            {isFR && <ListItem>{t('Accès aux commentaires')}</ListItem>}
            <ListItem>{t('Accès aux études sur le web')}</ListItem>
            <ListItem>{t("...Et plein d'autres à venir")}</ListItem>
          </Box>
          <Paragraph scale={-1} fontFamily="text">
            {t(
              'Tous les abonnements se renouvellent mensuellement de façon automatique. Vous avez la possibilité de les annuler quand vous le souhaitez.'
            )}
          </Paragraph>
          <Paragraph scale={-1} fontFamily="text" mt={10}>
            {t(
              'Vous pouvez également me soutenir par paypal ou tipeee pour devenir un sponsor. \nMerci de votre confiance et bonne étude!'
            )}
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
