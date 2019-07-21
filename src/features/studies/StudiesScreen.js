import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'

import StudiesHeader from './StudiesHeader'

const StudiesScreen = () => (
  <Container>
    <StudiesHeader />
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
