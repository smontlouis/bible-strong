import React from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import StylizedMarkdown from '~common/StylizedMarkdown'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { descriptionEn, descriptionFr } from './markdown'

export interface PremiumMoreProps {}

const PremiumMore = ({}: PremiumMoreProps) => {
  const isFR = useLanguage()
  const { t } = useTranslation()

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
      </ScrollView>
    </Container>
  )
}

export default PremiumMore
