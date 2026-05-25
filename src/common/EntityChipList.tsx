import styled from '@emotion/native'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { Tag } from './types'

const StyledChip = styled(Box)(({ theme }) => ({
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

type EntityChipListItem =
  | {
      type: 'tag'
      id: string
      label: string
      onPress: () => void
    }
  | {
      type: 'relation'
      id: string
      label: string
      onPress: () => void
    }

const EntityChipList = ({
  tags,
  relationCount = 0,
  onRelationPress,
  limit = 0,
}: {
  tags?: {
    [x: string]: Tag
  }
  relationCount?: number
  onRelationPress?: () => void
  limit?: number
}) => {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  const allTags = Object.values(tags || {})
  const hasMoreTags = limit > 0 && allTags.length > limit
  const visibleTags = limit && !isExpanded ? allTags.slice(0, limit) : allTags
  const items: EntityChipListItem[] = [
    ...visibleTags.map(tag => ({
      type: 'tag' as const,
      id: tag.id,
      label: tag.name,
      onPress: () => {
        router.push({ pathname: '/tag', params: { tagId: tag.id } })
      },
    })),
    ...(relationCount > 0 && onRelationPress
      ? [
          {
            type: 'relation' as const,
            id: 'relations',
            label: String(relationCount),
            onPress: onRelationPress,
          },
        ]
      : []),
  ]

  if (!items.length) {
    return null
  }

  return (
    <Box wrap row>
      {items.map(item => (
        <TouchableBox key={`${item.type}-${item.id}`} onPress={item.onPress}>
          <StyledChip>
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
          </StyledChip>
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

export default EntityChipList
