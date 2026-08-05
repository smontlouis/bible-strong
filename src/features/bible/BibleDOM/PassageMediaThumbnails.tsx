import { useState, type CSSProperties } from 'react'
import type { ResolvedPassageMedia } from '../passageMedia'
import type { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { useDispatch } from './DispatchProvider'
import { OPEN_PASSAGE_MEDIA } from './dispatch'
import { getDisabledStyles } from './disabledStyles'

type Props = RootStyles & {
  items: ResolvedPassageMedia[]
  placement: 'introduction' | 'inline' | 'chapter-resources'
  isParallel?: boolean
  isDisabled?: boolean
}

const INLINE_THUMBNAIL = {
  height: 25,
  aspectRatio: 1.3,
  parallelScale: 0.75,
  containerScale: 0.7,
  margin: 2,
}

const INTRODUCTION_THUMBNAIL = {
  height: 76,
  aspectRatio: 16 / 9,
  margin: '10px auto 28px',
}

const CHAPTER_RESOURCES_THUMBNAIL = {
  height: 76,
  aspectRatio: 16 / 9,
  margin: '42px auto 0',
}

const getStackTransform = (index: number, count: number) => {
  if (count <= 1) return 'none'

  const position = (index / (count - 1)) * 2 - 1
  return `translateX(${position * 3}px) rotate(${position * 5}deg)`
}

const PassageMediaThumbnails = ({
  items,
  placement,
  settings,
  isParallel,
  isDisabled = false,
}: Props) => {
  const dispatch = useDispatch()
  const [isPressed, setIsPressed] = useState(false)

  if (!items.length) return null

  const isInline = placement === 'inline'
  const blockThumbnail =
    placement === 'introduction' ? INTRODUCTION_THUMBNAIL : CHAPTER_RESOURCES_THUMBNAIL
  const inlineCardHeight =
    INLINE_THUMBNAIL.height * (isParallel ? INLINE_THUMBNAIL.parallelScale : 1)
  const inlineCardWidth = inlineCardHeight * INLINE_THUMBNAIL.aspectRatio
  const cardHeight = isInline
    ? scaleFontSize(inlineCardHeight, settings.fontSizeScale)
    : `${blockThumbnail.height}px`
  const cardWidth = isInline
    ? scaleFontSize(inlineCardWidth, settings.fontSizeScale)
    : `${blockThumbnail.height * blockThumbnail.aspectRatio}px`
  const containerHeight = isInline
    ? scaleFontSize(inlineCardHeight * INLINE_THUMBNAIL.containerScale, settings.fontSizeScale)
    : cardHeight
  const containerWidth = isInline
    ? scaleFontSize(inlineCardWidth * INLINE_THUMBNAIL.containerScale, settings.fontSizeScale)
    : cardWidth
  const colors = settings.colors[settings.theme]
  const stackStyle: CSSProperties = {
    position: 'relative',
    display: isInline ? 'inline-grid' : 'grid',
    width: containerWidth,
    height: containerHeight,
    margin: isInline ? `0 ${INLINE_THUMBNAIL.margin}px` : blockThumbnail.margin,
    overflow: 'visible',
    direction: 'ltr',
    isolation: 'isolate',
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: isDisabled ? 'default' : 'pointer',
    opacity: isPressed ? 0.55 : 1,
    transition: 'opacity 90ms ease',
    WebkitTapHighlightColor: 'transparent',
    ...getDisabledStyles(isDisabled),
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      data-ignore-verse-touch
      aria-label={items.map(item => item.title).join(', ')}
      style={stackStyle}
      onPointerDown={isDisabled ? undefined : () => setIsPressed(true)}
      onPointerUp={isDisabled ? undefined : () => setIsPressed(false)}
      onPointerCancel={isDisabled ? undefined : () => setIsPressed(false)}
      onPointerLeave={isDisabled ? undefined : () => setIsPressed(false)}
      onBlur={isDisabled ? undefined : () => setIsPressed(false)}
      onClick={
        isDisabled
          ? undefined
          : event => {
              event.stopPropagation()
              setIsPressed(false)
              void dispatch({ type: OPEN_PASSAGE_MEDIA, payload: items })
            }
      }
    >
      {items.map((item, index) => (
        <img
          key={item.editionId}
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          style={{
            gridArea: '1 / 1',
            display: 'block',
            width: cardWidth,
            height: cardHeight,
            boxSizing: 'border-box',
            objectFit: 'cover',
            placeSelf: 'center',
            border: `2px solid ${colors.reverse}`,
            borderRadius: isInline ? 5 : 9,
            boxShadow: '0 2px 7px rgba(0, 0, 0, 0.22)',
            transform: getStackTransform(index, items.length),
            transformOrigin: 'center',
            zIndex: index + 1,
          }}
        />
      ))}
    </button>
  )
}

export default PassageMediaThumbnails
