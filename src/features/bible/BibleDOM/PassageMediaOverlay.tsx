import { m, useReducedMotion, type Transition } from 'motion/react'
import { createPortal } from 'react-dom'
import { formatPassageMediaDuration, type ResolvedPassageMedia } from '../passageMedia'
import { useTranslations } from './TranslationsContext'
import PassageMediaImage from './PassageMediaImage'
import PassageMediaPlayer from './PassageMediaPlayer'
import { useModalOverlayLifecycle } from './overlayLifecycle'
import type { PassageMediaGallerySection } from './passageMediaGallery'
import {
  getOverlayAdditionalStartDelay,
  getOverlayLayoutTransition,
  getOverlaySourceDelay,
  OVERLAY_ADDITIONAL_STAGGER_SECONDS,
} from './overlayStagger'
import { NAVIGATE_TO_STRONG } from './dispatch'
import { useDispatch } from './DispatchProvider'

type Props = {
  items: ResolvedPassageMedia[]
  sections: PassageMediaGallerySection[]
  showSections: boolean
  sourceItemIds: string[]
  mode: 'closed' | 'gallery' | 'playing'
  selectedItem: ResolvedPassageMedia | null
  onClose: () => void
  onSelect: (item: ResolvedPassageMedia) => void
  placement: 'inline' | 'introduction' | 'chapter-resources'
}

type GalleryItemProps = {
  layoutId: string
  item: ResolvedPassageMedia
  reference: string
  isAdditionalItem: boolean
  additionalItemDelay: number
  sourceDelay: number
  itemRevealDelay: number
  shouldReduceMotion: boolean | null
  layoutTransition: Transition
  onSelect: (item: ResolvedPassageMedia) => void
  onOpenStrong: (strongCode: string) => void
}

const PassageMediaGalleryCard = ({
  layoutId,
  item,
  reference,
  isAdditionalItem,
  additionalItemDelay,
  sourceDelay,
  itemRevealDelay,
  shouldReduceMotion,
  layoutTransition,
  onSelect,
  onOpenStrong,
}: GalleryItemProps) => {
  const delayedLayoutTransition = { ...layoutTransition, delay: sourceDelay }

  return (
    <m.article
      layout
      initial={isAdditionalItem ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{
        layout: delayedLayoutTransition,
        opacity: {
          delay: isAdditionalItem ? additionalItemDelay : 0,
          duration: shouldReduceMotion ? 0 : 0.2,
        },
      }}
      onClick={event => event.stopPropagation()}
      style={{
        minWidth: 0,
        alignSelf: 'start',
        overflow: 'visible',
        color: '#171717',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        textAlign: 'left',
        background: 'transparent',
      }}
    >
      <m.button
        type="button"
        aria-label={item.title}
        whileTap={{ opacity: 0.55, scale: 0.98 }}
        onClick={event => {
          event.stopPropagation()
          onSelect(item)
        }}
        style={{
          display: 'block',
          width: '100%',
          margin: 0,
          padding: 0,
          border: 0,
          borderRadius: 11,
          background: 'transparent',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <PassageMediaImage
          item={item}
          layoutId={layoutId}
          transition={{ layout: delayedLayoutTransition }}
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            boxSizing: 'border-box',
            border: '2px solid #fff',
            borderRadius: 11,
            boxShadow: '0 7px 22px rgba(0, 0, 0, 0.25)',
          }}
        >
          <m.span
            style={{
              position: 'absolute',
              right: 7,
              bottom: 7,
              padding: '3px 7px',
              borderRadius: 999,
              background: 'rgba(0, 0, 0, 0.72)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 650,
              lineHeight: 1.1,
            }}
          >
            {formatPassageMediaDuration(item.durationSeconds)}
          </m.span>
        </PassageMediaImage>
      </m.button>
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: itemRevealDelay,
          duration: shouldReduceMotion ? 0 : 0.18,
        }}
        style={{ padding: '10px 2px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: '-webkit-box',
              minWidth: 0,
              overflow: 'hidden',
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.22,
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {item.title}
          </div>
          {item.strongCodes.length > 0 && (
            <div style={{ display: 'flex', flexShrink: 0, flexWrap: 'wrap', gap: 4 }}>
              {item.strongCodes.map(strongCode => (
                <m.button
                  key={strongCode}
                  type="button"
                  whileTap={{ opacity: 0.55, scale: 0.97 }}
                  onClick={event => {
                    event.stopPropagation()
                    onOpenStrong(strongCode)
                  }}
                  style={{
                    margin: 0,
                    padding: '4px 8px',
                    border: 0,
                    borderRadius: 999,
                    background: 'rgba(93, 135, 237, 0.14)',
                    color: '#416bc9',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {strongCode}
                </m.button>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 6,
            overflow: 'hidden',
            opacity: 0.7,
            fontSize: 11,
            lineHeight: 1.2,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {reference}
        </div>
      </m.div>
    </m.article>
  )
}

const PassageMediaOverlay = ({
  placement,
  items,
  sections,
  showSections,
  sourceItemIds,
  mode,
  selectedItem,
  onClose,
  onSelect,
}: Props) => {
  const translations = useTranslations()
  const dispatch = useDispatch()
  const shouldReduceMotion = useReducedMotion()
  const isOpen = mode !== 'closed'
  const overlayRef = useModalOverlayLifecycle({
    isOpen,
    onClose,
    focus: {
      selector: 'button:not([disabled]), iframe, [href], [tabindex]:not([tabindex="-1"])',
      refreshKey: mode,
      trap: true,
    },
  })
  const itemCount = sections.reduce((count, section) => count + section.items.length, 0)
  const chapterReference = `${translations.passageMediaBookName} ${translations.passageMediaChapter}`
  const displayedItems = showSections ? sections.flatMap(section => section.items) : items
  const displayedItemIds = new Set(displayedItems.map(item => item.editionId))
  const sourceItemIdSet = new Set(sourceItemIds)
  const displayedSourceItemIds = sourceItemIds.filter(editionId => displayedItemIds.has(editionId))
  const sourceItemIndexes = new Map(
    displayedSourceItemIds.map((editionId, index) => [editionId, index])
  )
  const additionalItemIndexes = new Map<string, number>()
  displayedItems.forEach(item => {
    if (!sourceItemIdSet.has(item.editionId)) {
      additionalItemIndexes.set(item.editionId, additionalItemIndexes.size)
    }
  })
  const sectionReferenceByEdition = new Map<string, string>()
  sections.forEach(section => {
    section.items.forEach(item => sectionReferenceByEdition.set(item.editionId, item.reference))
  })
  const additionalItemsStartDelay = getOverlayAdditionalStartDelay(
    displayedSourceItemIds.length,
    shouldReduceMotion
  )
  const getAdditionalItemDelay = (editionId: string) =>
    shouldReduceMotion
      ? 0
      : additionalItemsStartDelay +
        (additionalItemIndexes.get(editionId) ?? 0) * OVERLAY_ADDITIONAL_STAGGER_SECONDS
  const getSourceItemDelay = (editionId: string) =>
    getOverlaySourceDelay(sourceItemIndexes.get(editionId) ?? 0, shouldReduceMotion)
  const getItemRevealDelay = (editionId: string, isAdditionalItem: boolean) =>
    isAdditionalItem ? getAdditionalItemDelay(editionId) : getSourceItemDelay(editionId) + 0.18
  const getItemReference = (item: ResolvedPassageMedia) =>
    sectionReferenceByEdition.get(item.editionId) || item.reference || chapterReference

  const closeOverlay = () => {
    requestAnimationFrame(onClose)
  }

  const spring = getOverlayLayoutTransition(shouldReduceMotion)
  const getItemLayoutId = (item: ResolvedPassageMedia, index: number) =>
    placement === 'introduction' ? `introduction:${index}` : item.editionId
  const renderGalleryCard = (item: ResolvedPassageMedia, reference: string, index: number) => {
    const isAdditionalItem = !sourceItemIdSet.has(item.editionId)
    const sourceDelay = isAdditionalItem ? 0 : getSourceItemDelay(item.editionId)
    const layoutId = getItemLayoutId(item, index)

    return (
      <PassageMediaGalleryCard
        key={layoutId}
        layoutId={layoutId}
        item={item}
        reference={reference}
        isAdditionalItem={isAdditionalItem}
        additionalItemDelay={getAdditionalItemDelay(item.editionId)}
        sourceDelay={sourceDelay}
        itemRevealDelay={getItemRevealDelay(item.editionId, isAdditionalItem)}
        shouldReduceMotion={shouldReduceMotion}
        layoutTransition={spring}
        onSelect={onSelect}
        onOpenStrong={strongCode => {
          void dispatch({ type: NAVIGATE_TO_STRONG, payload: strongCode })
        }}
      />
    )
  }

  return createPortal(
    <m.div
      ref={overlayRef}
      layoutRoot
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      aria-label={isOpen ? translations.passageMediaTitle : undefined}
      data-ignore-verse-touch
      initial={false}
      animate={{
        backgroundColor: mode !== 'closed' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0)',
        backdropFilter: mode !== 'closed' ? 'blur(8px)' : 'blur(0px)',
      }}
      transition={{
        backgroundColor: { duration: shouldReduceMotion ? 0 : 0.48 },
        backdropFilter: { duration: shouldReduceMotion ? 0 : 0.2 },
      }}
      onClick={mode !== 'closed' ? closeOverlay : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        pointerEvents: isOpen ? 'auto' : 'none',
        touchAction: mode === 'gallery' ? 'pan-y' : 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitBackdropFilter: mode !== 'closed' ? 'blur(8px)' : 'blur(0px)',
        transition: `-webkit-backdrop-filter ${shouldReduceMotion ? 0 : 0.2}s ease`,
      }}
    >
      {mode === 'gallery' && !showSections && (
        <m.div
          key="gallery"
          layoutScroll
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            display: 'grid',
            gridTemplateColumns:
              items.length === 1 ? 'minmax(0, calc(50% - 7px))' : 'repeat(2, minmax(0, 1fr))',
            justifyContent: 'center',
            alignItems: 'start',
            alignContent: items.length <= 4 ? 'center' : 'start',
            gap: 14,
            padding:
              'max(30px, calc(var(--safe-area-top, 0px) + 14px)) 16px max(280px, calc(var(--safe-area-bottom, 0px) + 220px))',
            boxSizing: 'border-box',
            overscrollBehavior: 'contain',
          }}
        >
          {items.map((item, index) => renderGalleryCard(item, getItemReference(item), index))}
        </m.div>
      )}

      {mode === 'gallery' && showSections && (
        <m.div
          key="gallery"
          layoutScroll
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            padding:
              'max(30px, calc(var(--safe-area-top, 0px) + 14px)) 16px max(280px, calc(var(--safe-area-bottom, 0px) + 220px))',
            boxSizing: 'border-box',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            style={{
              display: 'flex',
              minHeight: '100%',
              flexDirection: 'column',
              justifyContent: itemCount <= 4 ? 'center' : 'flex-start',
              gap: 28,
            }}
          >
            {sections.map((section, sectionIndex) => (
              <section key={section.id}>
                {itemCount > 1 && (
                  <m.h2
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: 0.08 + sectionIndex * 0.06 }}
                    style={{
                      margin: '0 0 14px 2px',
                      color: '#5d87ed',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      fontSize: 12,
                      lineHeight: 1.2,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {section.title}
                  </m.h2>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      section.items.length === 1
                        ? 'minmax(0, calc(50% - 7px))'
                        : 'repeat(2, minmax(0, 1fr))',
                    justifyContent: itemCount === 1 ? 'center' : 'start',
                    alignItems: 'start',
                    gap: 14,
                  }}
                >
                  {section.items.map((item, index) =>
                    renderGalleryCard(item, item.reference, index)
                  )}
                </div>
              </section>
            ))}
          </div>
        </m.div>
      )}

      {mode === 'playing' && selectedItem && (
        <PassageMediaPlayer
          key="player"
          item={selectedItem}
          layoutId={getItemLayoutId(
            selectedItem,
            items.findIndex(item => item.editionId === selectedItem.editionId)
          )}
          layoutTransition={spring}
        />
      )}
    </m.div>,
    document.body
  )
}

export default PassageMediaOverlay
