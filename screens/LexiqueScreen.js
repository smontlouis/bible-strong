import React from 'react'

import Container from '@ui/Container'
import SearchHeader from '@components/SearchHeader'
import Text from '@ui/Text'
import Box from '@ui/Box'

export default class LexiqueScreen extends React.Component {
  render () {
    return (
      <Container>
        <SearchHeader
          placeholder='Recherche'
          onChangeText={value => console.log(value)}
        />
        <Box center flex>
          <Text>Bientôt disponible</Text>
        </Box>
      </Container>
    )
  }
}
