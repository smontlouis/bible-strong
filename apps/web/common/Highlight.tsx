import { Box, Text, TextProps } from '@chakra-ui/react'
import { connectHighlight } from 'react-instantsearch-dom'
import { HighlightProps } from 'react-instantsearch-core'
import React from 'react'

const Highlight = ({
  highlight,
  attribute,
  hit,
  variant,
  prefix,
  ...props
}: TextProps & HighlightProps & { prefix?: string }) => {
  const parsedHit = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit,
  })

  return (
    <Box>
      {parsedHit && (
        <Text as="span" {...props}>
          {prefix}
        </Text>
      )}
      {parsedHit.map((part, index) =>
        part.isHighlighted ? (
          <Text variant="bold" as="span" key={index} {...props}>
            {part.value}
          </Text>
        ) : (
          <Text color="black_050" as="span" key={index} {...props}>
            {part.value}
          </Text>
        )
      )}
    </Box>
  )
}

export default connectHighlight(Highlight)
