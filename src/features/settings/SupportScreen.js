import React from 'react'
import { Linking } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'

const LinkItem = styled(Link)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border
}))

const StyledIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: theme.colors[color] || theme.colors.grey,
  marginLeft: 'auto',
  marginRight: 15
}))

const LoginScreen = () => {
  return (
    <Container>
      <Header hasBackButton title="Soutenir le développeur" />
      <ScrollView>
        <Box padding={20}>
          <Text title fontSize={30} marginBottom={30}>
            Hello !
          </Text>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Avant toute chose, merci d'envisager de m'aider.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Plus vous êtes nombreux, plus le coût des serveurs augmente. L'application est
            développée sur mon temps libre et est totalement gratuite. Dieu m'a donné un don, et
            c'est un plaisir pour moi de l'utiliser à sa gloire.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Si vous souhaitez me soutenir, vous pouvez le faire de deux façons. Soit par{' '}
            <Paragraph
              color="primary"
              onPress={() => Linking.openURL('https://fr.tipeee.com/smontlouis')}
              bold>
              Tipeee,
            </Paragraph>{' '}
            ou par{' '}
            <Paragraph
              color="primary"
              onPress={() => Linking.openURL('https://www.paypal.me/smontlouis')}
              bold>
              Paypal
            </Paragraph>
            .
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Tipeee vous permet de soutenir en une fois ou mensuellement. Lorsque vous soutenez
            quelqu'un mensuellement, vous pouvez donner 1€ par mois par exemple.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Juste 1€ par mois ! Et comme dit le proverbe martiniquais :{' '}
            <Paragraph color="quart">"Sé grèn diri ka fè sak diri."</Paragraph>, "Ce sont les grains
            de riz qui font les sacs de riz.", autrement dit, l’accumulation de petites choses font
            de grandes choses.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Vous trouverez plus d'informations sur mon parcours et ma motivation sur ma page Tipeee.
          </Paragraph>
          <Paragraph scaleLineHeight={-1} marginBottom={20}>
            Merci de m'avoir lu et bonne étude !
          </Paragraph>
          <LinkItem href="https://fr.tipeee.com/smontlouis">
            <Text bold fontSize={16}>
              Lien Tipeee
            </Text>
            <StyledIcon name="arrow-right" size={25} />
          </LinkItem>
          <LinkItem href="https://www.paypal.me/smontlouis">
            <Text bold fontSize={16}>
              Lien paypal
            </Text>
            <StyledIcon name="arrow-right" size={25} />
          </LinkItem>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default LoginScreen
