import { getUniverseColor } from '~themes/universeColors'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import { FeatherIcon } from '~common/ui/Icon'
import type { SearchItemType } from '~state/searchFilters'

export const searchTypeIconConfig: Record<
  SearchItemType,
  {
    name?: React.ComponentProps<typeof FeatherIcon>['name']
    color: string
  }
> = {
  passages: { name: 'book-open', color: getUniverseColor('passages') },
  notes: { name: 'file-text', color: getUniverseColor('notes') },
  links: { name: 'link', color: getUniverseColor('links') },
  studies: { name: 'feather', color: getUniverseColor('studies') },
  strong: { color: getUniverseColor('strong') },
  dictionary: { color: getUniverseColor('dictionary') },
  nave: { color: getUniverseColor('nave') },
}

const SearchTypeIcon = ({
  type,
  size = 18,
  color,
}: {
  type: SearchItemType
  size?: number
  color?: string
}) => {
  const iconColor = color || searchTypeIconConfig[type].color

  switch (type) {
    case 'passages':
    case 'notes':
    case 'links':
    case 'studies':
      return <FeatherIcon name={searchTypeIconConfig[type].name!} size={size} color={iconColor} />
    case 'strong':
      return <LexiqueIcon color={iconColor} size={size} />
    case 'dictionary':
      return <DictionnaryIcon color={iconColor} size={size} />
    case 'nave':
      return <NaveIcon color={iconColor} size={size} />
  }
}

export default SearchTypeIcon
