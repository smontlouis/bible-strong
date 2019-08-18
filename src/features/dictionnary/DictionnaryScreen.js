import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'

import { useWaitForDatabase } from '~common/waitForDictionnaireDB'

const DictionnaryScreen = () => {
  const isLoading = useWaitForDatabase()
  console.log(isLoading)
  return (
    <Container>
      <Header title="Dictionnaire" />
      <Box>
        <Text>Dictionnary</Text>
      </Box>
    </Container>
  )
}

export default DictionnaryScreen
