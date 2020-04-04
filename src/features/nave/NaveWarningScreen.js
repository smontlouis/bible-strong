import React from 'react'
import { Linking } from 'react-native'
import * as Icon from '@expo/vector-icons'

import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'

const NaveWarningScreen = () => {
  return (
    <Container>
      <Header hasBackButton title="Informations importantes" />
      <ScrollView>
        <Box padding={20}>
          <Text title fontSize={30} marginBottom={30}>
            Bonjour,
          </Text>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            La Bible Thématique Nave se compose de plus de 20.000 sujets et
            sous-thèmes, et 100.000 références aux Écritures.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Malheureusement elle n'est disponible qu'en anglais. La traduction
            française présente dans l'application est une version traduite
            automatiquement.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Lorsque vous ouvrez une définition, vous aurez également sa
            signification anglaise entre parenthèses. J'ai fait de mon mieux
            pour avoir une traduction correcte, mais il y a beaucoup de fautes.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Si vous souhaitez aider pour la traduction, n'hésitez pas à me
            contacter. Je mettrai bientôt à disposition un excel pour entrer les
            erreurs de traduction.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Merci de m'avoir lu et bonne étude !
          </Paragraph>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default NaveWarningScreen
