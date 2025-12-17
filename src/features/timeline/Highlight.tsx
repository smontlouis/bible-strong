import styled from '@emotion/native'
import React from 'react'
import { connectHighlight } from 'react-instantsearch-native'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { calculateLabel } from './constants'

const StyledParagraph = styled(Paragraph)(({ theme, isLight }: any) => ({
  backgroundColor: isLight ? theme.colors.lightPrimary : 'transparent',
}))

const Highlight = ({ attribute, hit, highlight }: any) => {
  const highlights = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit,
  })

  return (
    <Box>
      <Paragraph small fontFamily="title">
        {highlights.map(({ value, isHighlighted }: any, index: any) => {
          return (
            <StyledParagraph fontFamily="title" isLight={isHighlighted} small key={index}>
              {value}
            </StyledParagraph>
          )
        })}{' '}
        ({calculateLabel(hit.start, hit.end)})
      </Paragraph>
    </Box>
  )
}

export default connectHighlight(Highlight)
