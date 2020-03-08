import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const Tag = styled(Box)(({ theme }) => ({
  borderRadius: 20,
  backgroundColor: theme.colors.lightPrimary,
  paddingTop: 3,
  paddingBottom: 3,
  paddingLeft: 7,
  paddingRight: 7,
  marginRight: 5,
  marginBottom: 2,
  marginTop: 5
}))

const TagList = ({ tags, limit }) => {
  if (!tags || !Object.values(tags).length) {
    return null
  }

  const array = limit
    ? Object.values(tags).slice(0, limit)
    : Object.values(tags)

  return (
    <Box wrap row>
      {array.map(tag => (
        <Tag key={tag.id}>
          <Text fontSize={10} color="primary">
            {tag.name}
          </Text>
        </Tag>
      ))}
      {!!(Object.values(tags).length - limit) && (
        <Text
          fontSize={10}
          color="primary"
          style={{
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: 0,
            paddingRight: 7,
            marginRight: 5,
            marginBottom: 2,
            marginTop: 4
          }}>
          + {Object.values(tags).length - limit}
        </Text>
      )}
    </Box>
  )
}

export default TagList
