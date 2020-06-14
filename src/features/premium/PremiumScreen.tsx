import React from 'react'

import Text from '~common/ui/Text'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import { FeatherIcon } from '~common/ui/Icon'
import { Linking, Platform } from 'react-native'
import { subVariant } from './SubscriptionPlan'
import { subSkus } from '~helpers/useInAppPurchases'
import SubscriptionGroup from './SubscriptionGroup'
import { useIsPremium } from '~helpers/usePremium'
import { LinkBox } from '~common/Link'
import ScrollView from '~common/ui/ScrollView'
import useLogin from '~helpers/useLogin'
import Paragraph from '~common/ui/Paragraph'

export const [oneMonthSkuMin, oneMonthSku, oneMonthSkuMax] = subSkus
export const mappingSku = {
  [oneMonthSkuMin]: {
    period: 'par mois',
    variant: 'normal' as subVariant,
  },
  [oneMonthSku]: {
    period: 'par mois',
    variant: 'primary' as subVariant,
  },
  [oneMonthSkuMax]: {
    period: 'par mois',
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

  if (!hasPremium) {
    return (
      <Container>
        <Header hasBackButton />
        <ScrollView>
          <Box p={20} mb={40}>
            <Text fontSize={30} title>
              Merci de nous soutenir !
            </Text>
            <Box mt={20}>
              <Paragraph scale={-1} fontFamily="text">
                Vous êtes actuellement abonné à Bible Strong premium. Vous avez
                accès aux fonctionnalités suivantes :
              </Paragraph>
            </Box>
            <Box mt={30}>
              <ListItem>Génération des études en page Web et PDF</ListItem>
              <ListItem>Recherche avancée dans la timeline</ListItem>
              <ListItem>...Et plein d'autres à venir</ListItem>
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
                Annuler l'abonnement
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
            Soutenez l'application: Abonnez-vous !
          </Text>
          <Box mt={20}>
            <Paragraph scale={-1} fontFamily="text">
              Merci de me soutenir ! Aujourd'hui l'application évolue, et ce
              grâce à vos retours. L'objectif de Bible Strong est de créer{' '}
              <Text bold>un outil complet d'études bibliques</Text> répondant à
              vos besoins, tout en vous proposant une expérience intuitive. Vous
              êtes nombreux à me faire part de votre satisfaction liée à la
              qualité de l’application Bible Strong, et je vous en remercie.
              {'\n\n'}Je souhaite donner l'opportunité à chacun de pouvoir
              s'impliquer dans l'évolution de l'application, en vous proposant
              le <Text bold>“pay what you want”</Text>: Un système de prix libre
              que vous choisissez et que vous estimez juste, tout en ayant accès
              à des
              <Text bold> fonctionnalités inédites:</Text>
            </Paragraph>
          </Box>
          <Box mt={30}>
            <ListItem>Génération des études en page Web et PDF</ListItem>
            <ListItem>Recherche avancée dans la timeline</ListItem>
            <ListItem>...Et plein d'autres à venir</ListItem>
          </Box>
          <Paragraph scale={-1} fontFamily="text">
            Merci de votre confiance et bonne étude !
          </Paragraph>
        </Box>
        {!isLogged ? (
          <Box px={40}>
            <Text textAlign="center" color="quart">
              Vous devez être enregistré pour accéder à l'offre d'abonnement.
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
