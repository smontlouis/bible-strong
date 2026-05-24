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
  passages: { name: 'book-open', color: 'color1' },
  notes: { name: 'file-text', color: 'color2' },
  studies: { name: 'feather', color: 'tertiary' },
  strong: { color: 'primary' },
  dictionary: { color: 'secondary' },
  nave: { color: 'quint' },
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
