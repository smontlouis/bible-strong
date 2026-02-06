import { useState } from 'react'
import { styled } from 'goober'
import * as Icon from '@expo/vector-icons'
import { scaleFontSize } from './scaleFontSize'
import { OPEN_HIGHLIGHT_TAGS, NAVIGATE_TO_TAG } from './dispatch'
import { RootStyles, TaggedVerse } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'
import { InlineItemContainer, InlineItemIconWrapper } from './InlineItem'
import { noSelect } from './utils'

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

const Tag = styled('span')<RootStyles>(
  ({ settings: { theme, colors, fontSizeScale, fontFamily } }) => ({
    fontFamily,
    padding: '0px 4px',
    borderRadius: '4px',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    fontSize: scaleFontSize(16, fontSizeScale),
    marginRight: '5px',
    cursor: 'pointer',
    ...noSelect,

    '&:active': {
      opacity: 0.5,
    },
  })
)

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

interface Props {
  settings: RootState['user']['bible']['settings']
  tag: TaggedVerse
  isDisabled?: boolean
}

const VerseTags = ({ tag, settings, isDisabled }: Props) => {
  const dispatch = useDispatch()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!tag.tags?.length) {
    return null
  }

  const limit = 1
  const hasMoreTags = tag.tags.length > limit
  const displayedTags = isExpanded ? tag.tags : tag.tags.slice(0, limit)
  const remainingCount = tag.tags.length - limit

  const { colors, theme } = settings
  const defaultColor = colors[theme].default

  const handleTagIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: OPEN_HIGHLIGHT_TAGS,
      payload: tag,
    })
  }

  const handleTagClick = (tagId: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: NAVIGATE_TO_TAG,
      payload: { tagId },
    })
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(true)
    // Dispatch after React render (next frame) to recalculate highlight overlays
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(false)
    // Dispatch after React render (next frame) to recalculate highlight overlays
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('layoutChanged'))
    })
  }

  return (
    <InlineItemContainer settings={settings} isDisabled={isDisabled}>
      {/* Tag icon - opens MultipleTagsModal */}

      <InlineItemIconWrapper settings={settings} isButton onClick={handleTagIconClick}>
        <Icon.Feather
          name="tag"
          size={Number(scaleFontSize(14, settings.fontSizeScale).replace('px', ''))}
          color={colors[theme].primary}
        />
      </InlineItemIconWrapper>

      {/* Individual tags - clickable to navigate */}
      {displayedTags.map(t => (
        <Tag key={t.id} settings={settings} onClick={handleTagClick(t.id)}>
          {t.name}
        </Tag>
      ))}

      {/* +N indicator - only visible when collapsed and has more tags */}
      {!isExpanded && hasMoreTags && (
        <ExpandButton settings={settings} onClick={handleExpandClick}>
          +{remainingCount}
        </ExpandButton>
      )}

      {/* Collapse button - only visible when expanded */}
      {isExpanded && hasMoreTags && (
        <IconButton settings={settings} onClick={handleCollapseClick}>
          <Icon.Feather
            name="chevron-left"
            size={Number(scaleFontSize(14, settings.fontSizeScale).replace('px', ''))}
            color={defaultColor}
          />
        </IconButton>
      )}
    </InlineItemContainer>
  )
}

export default VerseTags
