import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const LinkItem = styled(Link)({
  alignItems: 'center',
  width: '50%',
  padding: 20
})

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
  marginBottom: 15
}))

const HighlightsScreen = () => (
  (
    <Container>
      <Header hasBackButton noBorder title='Profil' />
      <Box />
    </Container>
  )
)

export default HighlightsScreen
