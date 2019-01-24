import React from 'react'
import { ExpoLinksView } from '@expo/samples'

import Container from '@ui/Container'
import Header from '@components/Header'

export default class LinksScreen extends React.Component {
  render () {
    return (
      <Container>
        <Header title='Liens' />
        <ExpoLinksView />
      </Container>
    )
  }
}
