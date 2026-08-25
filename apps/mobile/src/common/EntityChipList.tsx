import styled from '@emotion/native'
import React, { useState } from 'react'
import type { GestureResponderEvent } from 'react-native'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { Tag } from './types'
import { getEntityChipListState } from './entityChips'

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
  const pushRouteOnce = usePushRouteOnce()
  const [isExpanded, setIsExpanded] = useState(false)
  const { items, hasMoreTags, hiddenTagCount } = getEntityChipListState({
    tags,
    relationCount,
    canOpenRelations: !!onRelationPress,
    limit,
    isExpanded,
  })

  const handleChipPress = (item: (typeof items)[number], event?: GestureResponderEvent) => {
    event?.stopPropagation()

    if (item.type === 'relation') {
      onRelationPress?.()
      return
    }

    pushRouteOnce({ pathname: '/tag', params: { tagId: item.id } })
  }

  if (!items.length) {
    return null
  }

  return (
    <Box wrap row>
      {items.map(item => (
        <TouchableBox
          key={`${item.type}-${item.id}`}
          onPress={event => handleChipPress(item, event)}
        >
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
        <TouchableBox
          onPress={event => {
            event.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
        >
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
            {isExpanded ? '−' : `+ ${hiddenTagCount}`}
          </Text>
        </TouchableBox>
      )}
    </Box>
  )
}

export default EntityChipList
