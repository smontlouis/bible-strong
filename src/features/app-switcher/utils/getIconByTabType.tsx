import CommentIcon from '~common/CommentIcon'
import DictionnaryIcon from '~common/DictionnaryIcon'
import React from 'react'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import { FeatherIcon } from '~common/ui/Icon'
import { TabItem } from '../../../state/tabs'

const getIconByTabType = (type: TabItem['type'], size = 14) => {
  switch (type) {
    case 'bible':
      return <FeatherIcon name="book-open" size={size} />
    case 'compare':
      return <FeatherIcon name="repeat" size={size} />
    case 'strong':
    case 'strongs':
      return <LexiqueIcon width={size} height={size} />
    case 'commentary':
      return <CommentIcon width={size} height={size} color="#26A69A" />
    case 'dictionary':
    case 'dictionaries':
      return <DictionnaryIcon width={size} height={size} />
    case 'search':
      return <FeatherIcon name="search" size={size} />
    case 'nave':
    case 'naves':
      return <NaveIcon width={size} height={size} />
    case 'study':
      return <FeatherIcon name="feather" size={size} />
    case 'new':
      return <FeatherIcon name="plus" size={size} />
    default:
      return <FeatherIcon name="x" size={size} />
  }
}

export default getIconByTabType
