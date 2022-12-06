import { PrimitiveAtom, useAtom } from 'jotai'
import React, { memo } from 'react'
import { Image } from 'react-native'

import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { TabItem } from '../../../state/tabs'
import useTabConstants from '../utils/useTabConstants'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
}

const getIconType = (type: TabItem['type'], size = 14) => {
  switch (type) {
    case 'bible':
      return <FeatherIcon name="book-open" size={size} />
    case 'compare':
      return <FeatherIcon name="repeat" size={size} />
    case 'strong':
      return <LexiqueIcon width={size} height={size} />
    case 'commentary':
      return <CommentIcon width={size} height={size} color="#26A69A" />
    case 'dictionary':
      return <DictionnaryIcon width={size} height={size} />
    case 'search':
      return <FeatherIcon name="search" size={size} />
    case 'nave':
      return <NaveIcon width={size} height={size} />
    default:
      return <FeatherIcon name="x" size={size} />
  }
}

const TabPreview = ({ index, tabAtom }: TabPreviewProps & BoxProps) => {
  const [tab] = useAtom(tabAtom)
  const { WIDTH, HEIGHT, GAP } = useTabConstants()

  return (
    <AnimatedBox
      bg="reverse"
      center
      overflow="visible"
      width={WIDTH}
      height={HEIGHT}
      marginRight={GAP}
    >
      {tab.base64Preview ? (
        <Image
          style={{ width: '100%', height: '100%', borderRadius: 25 }}
          source={{ uri: `data:image/png;base64,${tab.base64Preview}` }}
        />
      ) : (
        <Box opacity={0.3}>{getIconType(tab.type, 30)}</Box>
      )}
    </AnimatedBox>
  )
}

export default memo(TabPreview)
