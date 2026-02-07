import styled from '@emotion/native'
import { useSetAtom } from 'jotai/react'
import React, { useState } from 'react'

import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Tag } from './types'
import { tagDetailModalAtom } from '~state/app'

const StyledTag = styled(Box)(({ theme }) => ({
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

const TagList = ({
  tags,
  limit = 0,
}: {
  tags?: {
    [x: string]: Tag
  }
  limit?: number
}) => {
  const setTagDetailModal = useSetAtom(tagDetailModalAtom)
  const [isExpanded, setIsExpanded] = useState(false)

  if (!tags || !Object.values(tags).length) {
    return null
  }

  const allTags = Object.values(tags)
  const hasMoreTags = limit > 0 && allTags.length > limit
  const array = limit && !isExpanded ? allTags.slice(0, limit) : allTags

  return (
    <Box wrap row>
      {array.map((tag: any) => (
        <TouchableBox key={tag.id} onPress={() => setTagDetailModal({ tagId: tag.id })}>
          <StyledTag>
            <Text fontSize={12} color="primary" numberOfLines={1} maxWidth={100}>
              {tag.name}
            </Text>
          </StyledTag>
        </TouchableBox>
      ))}
      {hasMoreTags && (
        <TouchableBox onPress={() => setIsExpanded(!isExpanded)}>
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
            {isExpanded ? '−' : `+ ${allTags.length - limit}`}
          </Text>
        </TouchableBox>
      )}
    </Box>
  )
}

export default TagList
