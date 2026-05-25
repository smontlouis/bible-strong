import Feather from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { RootState } from '~redux/modules/reducer'
import { RootStyles, VerseRelationItem } from './BibleDOMWrapper'
import { InlineItemContainer, InlineItemIconWrapper, InlineItemText } from './InlineItem'
import truncate from './truncate'

type SvgAsset = string | { uri?: string; default?: string }

const relationSvgSources: Record<'strong' | 'nave' | 'dictionary', SvgAsset> = {
  strong: require('~assets/images/tab-icons/lexique.svg'),
  nave: require('~assets/images/tab-icons/nave.svg'),
  dictionary: require('~assets/images/tab-icons/dictionary.svg'),
}

const resolveSvgAssetUri = (source: SvgAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

interface Props {
  relationItems: VerseRelationItem[]
  settings: RootState['user']['bible']['settings']
  onClick: (item: VerseRelationItem) => void
  isParallel?: boolean
  isDisabled?: boolean
}

const getIconColor = (
  targetType: VerseRelationItem['targetType'],
  settings: RootStyles['settings']
) => {
  const colors = settings.colors[settings.theme]

  switch (targetType) {
    case 'note':
      return colors.quart
    case 'externalLink':
      return colors.secondary
    case 'study':
      return colors.tertiary
    case 'verse':
      return colors.primary
    case 'strong':
      return colors.primary
    case 'nave':
      return colors.quint
    case 'dictionary':
      return colors.secondary
    case 'word':
      return colors.tertiary
    default:
      return colors.default
  }
}

const SvgMaskIcon = ({
  source,
  color,
  size = 15,
}: {
  source: SvgAsset
  color: string
  size?: number
}) => {
  const uri = resolveSvgAssetUri(source)

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        maskImage: `url(${uri})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(${uri})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  )
}

const RelationIcon = ({
  item,
  settings,
}: {
  item: VerseRelationItem
  settings: RootStyles['settings']
}) => {
  const color = getIconColor(item.targetType, settings)

  switch (item.targetType) {
    case 'note':
      return <Ionicons color={color} name="document-text-outline" size={16} />
    case 'externalLink':
      return <Feather color={color} name="link" size={16} />
    case 'study':
      return <Feather color={color} name="edit-3" size={16} />
    case 'strong':
      return <SvgMaskIcon source={relationSvgSources.strong} color={color} />
    case 'nave':
      return <SvgMaskIcon source={relationSvgSources.nave} color={color} />
    case 'dictionary':
      return <SvgMaskIcon source={relationSvgSources.dictionary} color={color} />
    case 'word':
      return <Feather color={color} name="type" size={16} />
    case 'verse':
    default:
      return <Feather color={color} name="book-open" size={16} />
  }
}

const RelationsText = ({ relationItems, settings, onClick, isParallel, isDisabled }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const visibleItems = isExpanded ? relationItems : relationItems.slice(0, 3)
  const hiddenCount = relationItems.length - visibleItems.length

  return (
    <span>
      {visibleItems.map(item => (
        <InlineItemContainer
          key={item.key}
          settings={settings}
          isParallel={isParallel}
          onClick={() => onClick(item)}
          isButton
          isDisabled={isDisabled}
        >
          <InlineItemIconWrapper settings={settings}>
            <RelationIcon item={item} settings={settings} />
          </InlineItemIconWrapper>
          <InlineItemText settings={settings}>{truncate(item.label, 40)}</InlineItemText>
        </InlineItemContainer>
      ))}
      {hiddenCount > 0 && (
        <InlineItemContainer
          settings={settings}
          isParallel={isParallel}
          onClick={() => setIsExpanded(true)}
          isButton
          isDisabled={isDisabled}
        >
          <InlineItemText settings={settings}>+{hiddenCount}</InlineItemText>
        </InlineItemContainer>
      )}
    </span>
  )
}

export default RelationsText
