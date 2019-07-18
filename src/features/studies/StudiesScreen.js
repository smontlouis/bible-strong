import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import Link from '~common/Link'
import Text from '~common/ui/Text'

const StudiesScreen = () => (
  <Container>
    <Header title='Études' />
    <Box flex>
      <Link route='EditStudy'>
        <Text>
        Edit Study
        </Text>
      </Link>
    </Box>
  </Container>
)

export default StudiesScreen
