import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useState } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getEntityChipListState } from './entityChips'
import { Tag } from './types'

const StyledChip = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'rounded-[20px] bg-light-primary pt-[3px] pb-[3px] pl-[7px] pr-[7px] mr-[5px] mb-[2px] mt-[5px]',
      className
    )
  )
  return (
    <Box
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Box>['style']}
      className="overflow-hidden border-continuous"
    />
  )
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
    <Box className="overflow-hidden border-continuous flex-wrap flex-row">
      {items.map(item => (
        <TouchableBox
          className="overflow-hidden border-continuous"
          key={`${item.type}-${item.id}`}
          onPress={event => handleChipPress(item, event)}
        >
          <StyledChip>
            <Box className="overflow-hidden border-continuous flex-row items-center">
              <FeatherIcon
                name={item.type === 'tag' ? 'tag' : 'git-merge'}
                size={10}
                color="primary"
              />
              <Text className="text-[12px] text-primary max-w-[100px] ml-[4px]" numberOfLines={1}>
                {item.label}
              </Text>
            </Box>
          </StyledChip>
        </TouchableBox>
      ))}
      {hasMoreTags && (
        <TouchableBox
          className="overflow-hidden border-continuous"
          onPress={event => {
            event.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
        >
          <Text
            className="text-[10px] text-primary"
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
