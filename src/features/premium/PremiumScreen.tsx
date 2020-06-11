import React from 'react'

import Text from '~common/ui/Text'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import { FeatherIcon } from '~common/ui/Icon'
import { ScrollView, Linking, Platform } from 'react-native'
import { subVariant } from './SubscriptionPlan'
import { subSkus } from '~helpers/useInAppPurchases'
import SubscriptionGroup from './SubscriptionGroup'
import { useIsPremium } from '~helpers/usePremium'
import { LinkBox } from '~common/Link'
import useLogin from '~helpers/useLogin'

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
    <Text marginLeft={20} fontSize={16}>
      {children}
    </Text>
  </Box>
)

const PremiumScreen = () => {
  const hasPremium = useIsPremium()
  const { isLogged } = useLogin()

  if (hasPremium) {
    return (
      <Container>
        <Header hasBackButton />
        <ScrollView>
          <Box p={20} mb={40}>
            <Text fontSize={30} title>
              Merci de nous soutenir !
            </Text>
            <Box py={20} mt={20}>
              <ListItem>
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
              </ListItem>
              <ListItem>
                Lorem Ipsum dolor sit Amet. Delectus necessitatibus
              </ListItem>
              <ListItem>Lorem Ipsum dolor sit Amet</ListItem>
              <ListItem>Lorem Ipsum dolor sit Amet</ListItem>
            </Box>
            <LinkBox
              onPress={() =>
                Linking.openURL(
                  Platform.OS === 'android'
                    ? 'https://play.google.com/store/account/subscriptions'
                    : 'https://apps.apple.com/account/subscriptions'
                )
              }
            >
              <Text>Annuler l'abonnement</Text>
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
          <Box py={20} mt={20}>
            <ListItem>
              Lorem ipsum dolor sit amet consectetur adipisicing elit.
            </ListItem>
            <ListItem>
              Lorem Ipsum dolor sit Amet. Delectus necessitatibus
            </ListItem>
            <ListItem>Lorem Ipsum dolor sit Amet</ListItem>
            <ListItem>Lorem Ipsum dolor sit Amet</ListItem>
          </Box>
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
