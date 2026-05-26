import Feather from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { styled } from 'goober'
import { RootState } from '~redux/modules/reducer'
import { RootStyles, VerseRelationItem } from './BibleDOMWrapper'
import { InlineItemContainer } from './InlineItem'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { noSelect } from './utils'

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

const RelationTag = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    padding: '0px 4px',
    borderRadius: '4px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(isParallel ? 10 : 16, fontSizeScale),
    marginRight: '5px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: isParallel ? '110px' : '190px',
    ...noSelect,

    '&:active': {
      opacity: 0.5,
    },
  })
)

const RelationIconWrapper = styled('span')<RootStyles>(({ settings: { fontFamily } }) => ({
  fontFamily,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: '5px',
  flexShrink: 0,
}))

const RelationLabel = styled('span')<RootStyles>(({ settings: { fontFamily } }) => ({
  fontFamily,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  ...noSelect,
}))

const ExpandButton = styled('div')<RootStyles>(
  ({ settings: { theme, colors, fontSizeScale, fontFamily } }) => ({
    fontFamily,
    padding: '0px 4px',
    borderRadius: '4px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(12, fontSizeScale),
    marginLeft: '5px',
    opacity: 0.5,
    cursor: 'pointer',
    display: 'inline-flex',
    ...noSelect,
    '&:active': {
      opacity: 0.4,
    },
  })
)

const IconButton = styled('div')<RootStyles>(
  ({ settings: { theme, colors, fontSizeScale, fontFamily } }) => ({
    fontFamily,
    padding: '2px 4px',
    borderRadius: '4px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(12, fontSizeScale),
    opacity: 0.5,
    cursor: 'pointer',
    display: 'inline-flex',
    '&:active': {
      opacity: 0.4,
    },
  })
)

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
  const hasMoreItems = relationItems.length > 3

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(true)
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(false)
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }

  return (
    <InlineItemContainer settings={settings} isDisabled={isDisabled}>
      {visibleItems.map(item => (
        <RelationTag
          key={item.key}
          settings={settings}
          isParallel={isParallel}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            onClick(item)
          }}
        >
          <RelationIconWrapper settings={settings}>
            <RelationIcon item={item} settings={settings} />
          </RelationIconWrapper>
          <RelationLabel settings={settings}>{truncate(item.label, 40)}</RelationLabel>
        </RelationTag>
      ))}
      {hiddenCount > 0 && (
        <ExpandButton settings={settings} onClick={handleExpandClick}>
          +{hiddenCount}
        </ExpandButton>
      )}
      {isExpanded && hasMoreItems && (
        <IconButton settings={settings} onClick={handleCollapseClick}>
          <Feather
            name="chevron-left"
            size={Number(scaleFontSize(14, settings.fontSizeScale).replace('px', ''))}
            color={settings.colors[settings.theme].default}
          />
        </IconButton>
      )}
    </InlineItemContainer>
  )
}

export default RelationsText
