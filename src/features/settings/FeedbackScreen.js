import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import { Button, Linking } from 'react-native'

import Box from '~common/ui/Box'

export default class SettingsScreen extends React.Component {
  render () {
    /* Go ahead and delete ExpoConfigView and replace it with your
     * content, we just wanted to give you a quick view of your config */
    return (
      <Container>
        <Header hasBackButton noBorder title='Profil' />
        <Box center flex>
          <Button
            onPress={() =>
              Linking.openURL(
                "mailto:s.montlouis.calixte+feedback@gmail.com?subject=Feedback Bible Strong App&body=Votre retour ici...\n Merci de joindre une capture d'écran si nécessaire"
              )
            }
            title="J'envoie mon feedback"
            color='#841584'
            accessibilityLabel='Learn more about this purple button'
          />
        </Box>
      </Container>
    )
  }
}
