import styled from '@emotion/native'
import { useSetAtom } from 'jotai/react'
import React, { useState } from 'react'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
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

export type RelationChip = {
  id: string
  label: string
  onPress: () => void
}

const EntityChipList = ({
  tags,
  relationList,
  limit = 0,
}: {
  tags?: {
    [x: string]: Tag
  }
  relationList?: RelationChip[]
  limit?: number
}) => {
  const setTagDetailModal = useSetAtom(tagDetailModalAtom)
  const [isExpanded, setIsExpanded] = useState(false)

  const allTags = Object.values(tags || {})
  const allRelations = relationList || []
  const allItems = [
    ...allTags.map(tag => ({ type: 'tag' as const, id: tag.id, label: tag.name, tag })),
    ...allRelations.map(relation => ({
      type: 'relation' as const,
      id: relation.id,
      label: relation.label,
      relation,
    })),
  ]

  if (!allItems.length) {
    return null
  }

  const hasMoreItems = limit > 0 && allItems.length > limit
  const array = limit && !isExpanded ? allItems.slice(0, limit) : allItems

  return (
    <Box wrap row>
      {array.map(item => (
        <TouchableBox
          key={`${item.type}-${item.id}`}
          onPress={() =>
            item.type === 'tag'
              ? setTagDetailModal({ tagId: item.tag.id })
              : item.relation.onPress()
          }
        >
          <StyledTag>
            <Box row alignItems="center">
              <FeatherIcon
                name={item.type === 'tag' ? 'tag' : 'git-merge'}
                size={10}
                color="primary"
              />
              <Text fontSize={12} color="primary" numberOfLines={1} maxWidth={100} ml={4}>
                {item.label}
              </Text>
            </Box>
          </StyledTag>
        </TouchableBox>
      ))}
      {hasMoreItems && (
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
            {isExpanded ? '−' : `+ ${allItems.length - limit}`}
          </Text>
        </TouchableBox>
      )}
    </Box>
  )
}

export default EntityChipList
