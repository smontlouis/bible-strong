import React from 'react'
import { connectHighlight } from 'react-instantsearch-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import styled from '~styled'
import Paragraph from '~common/ui/Paragraph'

const StyledParagraph = styled(Paragraph)(({ theme, isLight }) => ({
  backgroundColor: isLight ? theme.colors.lightPrimary : 'transparent',
}))

const Snippet = ({ highlight, attribute, hit }) => {
  const parsedHit = highlight({
    highlightProperty: '_snippetResult',
    attribute,
    hit,
  })

  if (!parsedHit?.length) {
    return null
  }

  return (
    <Box>
      <Paragraph small>
        {parsedHit.map(({ value, isHighlighted }, index) => {
          return (
            <StyledParagraph isLight={isHighlighted} small key={index}>
              {value}
            </StyledParagraph>
          )
        })}{' '}
        [...]
      </Paragraph>
    </Box>
  )
}

export default connectHighlight(Snippet)
