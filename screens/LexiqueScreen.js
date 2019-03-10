import React from 'react'

import Container from '@ui/Container'
import SearchHeader from '@components/SearchHeader'
import debounce from 'debounce'
import Text from '@ui/Text'
import Box from '@ui/Box'

export default class LexiqueScreen extends React.Component {
  onChangeText = value => {
    console.log(value)
  }
  render () {
    return (
      <Container>
        <SearchHeader
          placeholder='Recherche'
          onChangeText={debounce(this.onChangeText, 500)}
        />
        <Box center flex>
          <Text>Bientôt disponible</Text>
        </Box>
      </Container>
    )
  }
}
