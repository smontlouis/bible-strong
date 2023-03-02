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
import { useInitIAP } from '~helpers/useInAppPurchases'
import useLanguage from '~helpers/useLanguage'
import useLogin from '~helpers/useLogin'
import { useIsPremium, usePremiumType } from '~helpers/usePremium'
import { descriptionEn, descriptionFr } from './markdown'
import SubscriptionGroup from './SubscriptionGroup'

const PremiumScreen = () => {
  const hasPremium = useIsPremium()
  const premiumType = usePremiumType()
  const { isLogged } = useLogin()
  const { t } = useTranslation()
  const isFR = useLanguage()

  useInitIAP()

  return (
    <Container>
      <Header hasBackButton title={t('Devenez un sponsor !')} />
      <ScrollView>
        {hasPremium && (
          <Box p={20} mb={40}>
            <Text fontSize={30} title>
              {t('Merci de nous soutenir !')}
            </Text>
            <Box mt={20}>
              <Paragraph fontFamily="paragraph">
                {t(`premium.${premiumType}.description`)}
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
        )}
        <Box px={20}>
          <StylizedMarkdown>
            {isFR ? descriptionFr : descriptionEn}
          </StylizedMarkdown>
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
