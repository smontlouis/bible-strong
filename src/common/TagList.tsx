import styled from '@emotion/native'
import { useRouter } from 'expo-router'
import React from 'react'

import Box, { TouchableBox } from '~common/ui/Box'
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
  marginTop: 5,
}))

const TagList = ({ tags, limit }: { tags: any; limit: any }) => {
  const router = useRouter()

  if (!tags || !Object.values(tags).length) {
    return null
  }

  const array = limit ? Object.values(tags).slice(0, limit) : Object.values(tags)

  return (
    <Box wrap row>
      {array.map((tag: any) => (
        <TouchableBox
          key={tag.id}
          onPress={() =>
            router.push({
              pathname: '/tag',
              params: { tagId: tag.id },
            })
          }
        >
          <Tag>
            <Text fontSize={10} color="primary">
              {tag.name}
            </Text>
          </Tag>
        </TouchableBox>
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
            marginTop: 4,
          }}
        >
          + {Object.values(tags).length - limit}
        </Text>
      )}
    </Box>
  )
}

export default TagList
