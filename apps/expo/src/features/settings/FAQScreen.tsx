import React from 'react'

import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Accordion from '~common/ui/Accordion'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'

const FAQScreen = () => {
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title="FAQ" />
      <ScrollView>
        <Box padding={20}>
          <Text title fontSize={30} marginBottom={30}>
            {t('Bienvenue')},
          </Text>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            {t("J'ai regroupé ici la plupart des questions qui me sont régulièrement posées.")}
          </Paragraph>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t('faq.whiteScreenQuestion')}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t('faq.whiteScreenAnswer')}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t("L'application est lente")}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t(
                "Si l'application est lente sur votre téléphone, j'en suis navré. Bible Strong utilise des bases de données lexique et dictionnaire qui contiennent des milliers d'entrées. Généralement les téléphones récents ont de bonnes performances sur l'application.\n\nPetit à petit je vais optimiser certaines parties de l'app comme le lexique et le dictionnaire."
              )}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t("L'application prend beaucoup de place")}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t(
                "J'ai fait le choix de vous fournir le lexique, les bibles et le dictionnaire hors-ligne pour faciliter la rapidité d'accès.\n\nL'avantage est biensur l'accès rapide et hors-ligne de toutes vos informations, l'inconvénient est la taille de l'application.\n\n~20Mo pour l'index, ~25Mo pour le dictionnaire, ~30Mo pour le lexique Hébreu. Chaque bible pèse environ ~5Mo. \n\nEn tout l'application peut arriver jusqu'à 200Mo, donc assurez-vous d'avoir de la place."
              )}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t("J'ai constaté un bug")}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t('faq.bugNoticedAnswer')}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t("J'ai une idée de fonctionnalité")}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t('faq.ideaAnswer')}
            </Paragraph>
          </Accordion>
          {/* <Accordion
            title={
              <Text title fontSize={18}>
                {t(
                  'Pourquoi l’application contient-elle du contenu adventiste ?'
                )}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t(
                "L'app contient du contenu adventiste, mais également du contenu d’autres confessions. Je ne me suis pas concentré sur la religion, mais plutôt sur la qualité du contenu. Par exemple, la timeline d’Amazing Facts est la seule que je connaisse qui soit aussi complète. Si vous ne partagez pas la foi adventiste, il est normal que vous puissiez être en désaccord avec certains contenus."
              )}
            </Paragraph>
          </Accordion> */}
          <Accordion
            title={
              <Text title fontSize={18}>
                {t('Qui êtes-vous ?')}
              </Text>
            }
          >
            <Paragraph marginLeft={20} scale={-1}>
              {t('who-are-you')}
            </Paragraph>
          </Accordion>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default FAQScreen
