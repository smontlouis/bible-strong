import { Box, Flex, Text } from '@chakra-ui/react'
import React from 'react'
import { Study } from './types'

interface Props {
  tags: Study['tags']
  limit?: number
}
const TagList = ({ tags, limit = 5 }: Props) => {
  if (!tags || !Object.values(tags).length) {
    return null
  }

  const array = limit
    ? Object.values(tags).slice(0, limit)
    : Object.values(tags)

  return (
    <Flex flexWrap="wrap" alignItems="center" mt="m">
      {array.map((tag) => (
        <Box
          key={tag.id}
          borderRadius="full"
          bg="lightPrimary"
          px={3}
          py={1}
          mr="s"
          mb="s"
        >
          <Text size="s" color="primary">
            {tag.name}
          </Text>
        </Box>
      ))}
      {!!(Object.values(tags).length - limit > 0) && (
        <Text ml="s" size="s" color="primary">
          + {Object.values(tags).length - limit}
        </Text>
      )}
    </Flex>
  )
}

export default TagList
