import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import { ExpoConfigView } from '@expo/samples'

export default class SettingsScreen extends React.Component {
  render () {
    /* Go ahead and delete ExpoConfigView and replace it with your
     * content, we just wanted to give you a quick view of your config */
    return (
      <Container>
        <Header hasBackButton noBorder title='Configuration' />
        <ExpoConfigView />
      </Container>
    )
  }
}
