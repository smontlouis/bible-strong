import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import { Linking } from 'react-native'

import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'

const SupportScreen = () => {
  const stylingTheme = useStylingTheme()

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title="Soutenir le développeur" />
      <ScrollView backgroundColor="canvas">
        <Box className="px-[24px]">
          <Text className="text-[28px] mb-[16px]" style={titleFontStyle(stylingTheme)}>
            Hello !
          </Text>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Avant toute chose, merci d’envisager de m’aider.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Plus vous êtes nombreux, plus le coût des serveurs augmente. L’application est
            développée sur mon temps libre et est totalement gratuite. Dieu m’a donné un don, et
            c’est un plaisir pour moi de l’utiliser à sa gloire.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Si vous souhaitez me soutenir, vous pouvez le faire de deux façons. Soit par{' '}
            <Paragraph
              className="text-link font-bold"
              onPress={() => Linking.openURL('https://fr.tipeee.com/smontlouis')}
            >
              Tipeee,
            </Paragraph>{' '}
            ou par{' '}
            <Paragraph
              className="text-link font-bold"
              onPress={() => Linking.openURL('https://www.paypal.me/smontlouis')}
            >
              PayPal
            </Paragraph>
            .
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Tipeee vous permet de soutenir en une fois ou mensuellement. Lorsque vous soutenez
            quelqu’un mensuellement, vous pouvez donner 1 € par mois par exemple.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Juste 1 € par mois ! Et comme dit le proverbe martiniquais :{' '}
            <Paragraph className="text-quart">« Sé grèn diri ka fè sak diri. »</Paragraph>, « Ce
            sont les grains de riz qui font les sacs de riz. », autrement dit, l’accumulation de
            petites choses font de grandes choses.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Vous trouverez plus d’informations sur mon parcours et ma motivation sur ma page Tipeee.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Merci de m’avoir lu et bonne étude !
          </Paragraph>
        </Box>
        <ListSection>
          <ListRow
            href="https://fr.tipeee.com/smontlouis"
            icon={<FeatherIcon name="heart" size={18} color="color2" />}
            iconTint="color2"
            label="Lien Tipeee"
          />
          <ListRow
            href="https://www.paypal.me/smontlouis"
            icon={<FeatherIcon name="credit-card" size={18} color="primary" />}
            iconTint="primary"
            label="Lien PayPal"
          />
        </ListSection>
      </ScrollView>
    </Container>
  )
}
export default SupportScreen
