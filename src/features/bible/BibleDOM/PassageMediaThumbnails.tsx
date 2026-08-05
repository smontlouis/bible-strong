import { domMax, LayoutGroup, LazyMotion, m, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { ResolvedPassageMedia } from '../passageMedia'
import type { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'
import { getDisabledStyles } from './disabledStyles'
import PassageMediaImage from './PassageMediaImage'
import PassageMediaOverlay from './PassageMediaOverlay'
import type { PassageMediaGallerySection } from './passageMediaGallery'
import { SET_BIBLE_OVERLAY_OPEN } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { registerVisibleScrollEffect } from './visibleScrollEffects'

type Props = RootStyles & {
  items: ResolvedPassageMedia[]
  placement: 'introduction' | 'inline' | 'chapter-resources'
  isParallel?: boolean
  isDisabled?: boolean
  isCompact?: boolean
  blockMargin?: CSSProperties['margin']
  gallerySections: PassageMediaGallerySection[]
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

const COMPACT_INTRODUCTION_THUMBNAIL = {
  height: 30,
  aspectRatio: 1.6,
  margin: '-18px 0 20px',
}

const CHAPTER_RESOURCES_THUMBNAIL = {
  height: 76,
  aspectRatio: 16 / 9,
  margin: '42px auto 0',
}

const MAX_STACKED_THUMBNAILS = 3

const INTRODUCTION_PARALLAX = {
  scrollDistance: 90,
  minimumScale: 0,
}

const INLINE_SCROLL_SCALE = {
  distanceFromHeader: 30,
  minimumScale: 0.2,
}

const getStackTransform = (index: number, count: number) => {
  if (count <= 1) return { x: 0, rotate: 0 }

  const position = (index / (count - 1)) * 2 - 1
  return { x: position * 3, rotate: position * 5 }
}

const PassageMediaThumbnails = ({
  items,
  placement,
  settings,
  isParallel,
  isDisabled = false,
  isCompact = false,
  blockMargin,
  gallerySections,
}: Props) => {
  const layoutGroupId = useId()
  const dispatch = useDispatch()
  const shouldReduceMotion = useReducedMotion()
  const stackRef = useRef<HTMLButtonElement>(null)
  const introductionParallaxScale = useMotionValue(1)
  const inlineScrollScale = useMotionValue(1)
  const [mode, setMode] = useState<'closed' | 'gallery' | 'playing'>('closed')
  const [selectedItem, setSelectedItem] = useState<ResolvedPassageMedia | null>(null)
  const isOverlayOpen = mode !== 'closed'

  useEffect(() => {
    if (!isOverlayOpen) return

    void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: true })
    return () => {
      void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: false })
    }
  }, [dispatch, isOverlayOpen])

  useEffect(() => {
    const stackElement = stackRef.current
    if (shouldReduceMotion) {
      introductionParallaxScale.set(1)
      inlineScrollScale.set(1)
      return
    }
    if (mode !== 'closed' || !stackElement) return

    if (placement === 'introduction') {
      return registerVisibleScrollEffect(stackElement, ({ scrollY }) => {
        const progress = Math.min(Math.max(scrollY / INTRODUCTION_PARALLAX.scrollDistance, 0), 1)
        introductionParallaxScale.set(1 - progress * (1 - INTRODUCTION_PARALLAX.minimumScale))
      })
    }

    if (placement !== 'inline') return

    return registerVisibleScrollEffect(stackElement, ({ elementTop, headerHeight }) => {
      const progress = Math.min(
        Math.max(
          (headerHeight + INLINE_SCROLL_SCALE.distanceFromHeader - elementTop) /
            INLINE_SCROLL_SCALE.distanceFromHeader,
          0
        ),
        1
      )
      inlineScrollScale.set(1 - progress * (1 - INLINE_SCROLL_SCALE.minimumScale))
    })
  }, [inlineScrollScale, introductionParallaxScale, mode, placement, shouldReduceMotion])

  if (!items.length) return null

  const isInline = placement === 'inline'
  const blockThumbnail =
    placement === 'introduction'
      ? isCompact
        ? COMPACT_INTRODUCTION_THUMBNAIL
        : INTRODUCTION_THUMBNAIL
      : CHAPTER_RESOURCES_THUMBNAIL
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
  const stackedItems = items.slice(0, MAX_STACKED_THUMBNAILS)
  const layoutTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 360, damping: 34, mass: 0.8 }
  const stackStyle: CSSProperties = {
    position: 'relative',
    display: isInline ? 'inline-grid' : 'grid',
    width: containerWidth,
    height: containerHeight,
    margin: isInline ? `0 ${INLINE_THUMBNAIL.margin}px` : (blockMargin ?? blockThumbnail.margin),
    overflow: 'visible',
    direction: 'ltr',
    isolation: 'isolate',
    padding: 0,
    border: 0,
    background: 'transparent',
    cursor: isDisabled ? 'default' : 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    transformOrigin: 'center bottom',
    ...getDisabledStyles(isDisabled),
  }

  return (
    <LazyMotion features={domMax} strict>
      <LayoutGroup id={layoutGroupId}>
        <m.button
          ref={stackRef}
          layoutId={placement === 'introduction' ? 'passage-media-introduction-stack' : undefined}
          type="button"
          disabled={isDisabled}
          aria-disabled={isDisabled}
          data-ignore-verse-touch
          aria-label={items.map(item => item.title).join(', ')}
          style={{
            ...stackStyle,
            scale:
              placement === 'introduction'
                ? introductionParallaxScale
                : placement === 'inline'
                  ? inlineScrollScale
                  : 1,
          }}
          whileTap={isDisabled ? undefined : { opacity: 0.55 }}
          onClick={
            isDisabled
              ? undefined
              : event => {
                  event.stopPropagation()
                  setMode('gallery')
                }
          }
        >
          {stackedItems.map((item, index) => {
            const transform = getStackTransform(index, stackedItems.length)

            return (
              <PassageMediaImage
                item={item}
                layoutId={item.editionId}
                key={item.editionId}
                loading="lazy"
                transition={{ layout: layoutTransition }}
                style={{
                  gridArea: '1 / 1',
                  display: 'block',
                  width: cardWidth,
                  height: cardHeight,
                  boxSizing: 'border-box',
                  placeSelf: 'center',
                  border: `2px solid ${colors.reverse}`,
                  borderRadius: isCompact ? 7 : isInline ? 5 : 9,
                  boxShadow: '0 2px 7px rgba(0, 0, 0, 0.22)',
                  x: transform.x,
                  rotate: transform.rotate,
                  transformOrigin: 'center',
                  zIndex: index + 1,
                }}
              />
            )
          })}
        </m.button>
        <PassageMediaOverlay
          items={items}
          sections={gallerySections}
          showSections={placement === 'chapter-resources'}
          sourceItemIds={stackedItems.map(item => item.editionId)}
          mode={mode}
          selectedItem={selectedItem}
          onSelect={item => {
            setSelectedItem(item)
            setMode('playing')
          }}
          onClose={() => {
            setMode('closed')
            setSelectedItem(null)
          }}
        />
      </LayoutGroup>
    </LazyMotion>
  )
}

export default PassageMediaThumbnails
