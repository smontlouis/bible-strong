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
  marginBottom: 5,
  marginTop: 5
}))

const TagList = ({ tags }) => {
  if (!tags || !Object.values(tags).length) {
    return null
  }

  console.log(tags)
  return (
    <Box row>
      {
        Object.values(tags).map(
          tag => (
            <Tag key={tag.id}>
              <Text fontSize={10} color='primary'>{tag.name}</Text>
            </Tag>
          )
        )
      }
    </Box>
  )
}

export default TagList
