import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
const NaveWarningScreen = () => {
  const stylingTheme = useStylingTheme()

  return (
    <Container>
      <Header hasBackButton title="Informations importantes" />
      <ScrollView>
        <Box className="overflow-hidden border-continuous p-[20px]">
          <Text
            className="text-[30px] mb-[30px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            Bonjour,
          </Text>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            La Bible Thématique Nave se compose de plus de 20.000 sujets et sous-thèmes, et 100.000
            références aux Écritures.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Malheureusement elle n'est disponible qu'en anglais. La traduction française présente
            dans l'application est une version traduite automatiquement.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Lorsque vous ouvrez une définition, vous aurez également sa signification anglaise entre
            parenthèses. J'ai fait de mon mieux pour avoir une traduction correcte, mais il y a
            beaucoup de fautes.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Si vous souhaitez aider pour la traduction, n'hésitez pas à me contacter. Je mettrai
            bientôt à disposition un excel pour entrer les erreurs de traduction.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Merci de m'avoir lu et bonne étude !
          </Paragraph>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default NaveWarningScreen
