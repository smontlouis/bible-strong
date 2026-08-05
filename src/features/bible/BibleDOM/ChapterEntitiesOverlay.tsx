import { m, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'

import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntityCategory,
} from '~features/resources/strongLexiconAccess'
import {
  getStrongEntityAvatarKey,
  type StrongEntityPresentationKind,
} from '~features/lexique/strongEntityPresentation'
import { ENTITY_AVATAR_IMAGES } from '~features/lexique/strongEntityAvatars'
import {
  getOverlayAdditionalStartDelay,
  getOverlaySourceDelay,
  OVERLAY_ADDITIONAL_STAGGER_SECONDS,
} from './overlayStagger'

type RasterAsset = string | { uri?: string; default?: string }

const resolveRasterAssetUri = (source: RasterAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

export const getChapterEntityAvatarUri = (entity: StrongLexiconChapterEntity) => {
  const presentationKind: StrongEntityPresentationKind =
    entity.category === 'supernatural' ? 'other' : entity.category
  const avatar = getStrongEntityAvatarKey(presentationKind, entity.type)
  return resolveRasterAssetUri(ENTITY_AVATAR_IMAGES[avatar])
}

type Props = {
  entities: StrongLexiconChapterEntity[]
  groupLabels: Record<StrongLexiconEntityCategory, string>
  openEntityLabel: string
  colors: {
    default: string
    primary: string
    reverse: string
  }
  fontFamily: string
  visibleStackItemCount: number
  isOpen: boolean
  onClose: () => void
  onSelect: (uniqueName: string) => void
}

const ChapterEntitiesOverlay = ({
  entities,
  groupLabels,
  openEntityLabel,
  colors,
  fontFamily,
  visibleStackItemCount,
  isOpen,
  onClose,
  onSelect,
}: Props) => {
  const shouldReduceMotion = useReducedMotion()
  const overlayRef = useRef<HTMLDivElement>(null)
  const handleCloseEvent = useEffectEvent(onClose)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.documentElement.style.overflow
    const previousSwipeDownEvent = window.disableSwipeDownEvent
    const overlayElement = overlayRef.current
    const backgroundElements = Array.from(document.body.children).filter(
      element => element !== overlayElement
    ) as HTMLElement[]
    const backgroundStates = backgroundElements.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))

    window.disableSwipeDownEvent = true
    document.documentElement.style.overflow = 'hidden'
    backgroundElements.forEach(element => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseEvent()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.documentElement.style.overflow = previousOverflow
      window.disableSwipeDownEvent = previousSwipeDownEvent
      backgroundStates.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
    }
  }, [isOpen])

  const spring = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 360, damping: 34, mass: 0.8 }
  const itemIndexes = new Map(entities.map((entity, index) => [entity.uniqueName, index]))
  const sourceItemCount = Math.min(visibleStackItemCount, entities.length)
  const additionalItemsStartDelay = getOverlayAdditionalStartDelay(
    sourceItemCount,
    shouldReduceMotion
  )

  return createPortal(
    <m.div
      ref={overlayRef}
      layoutRoot
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      data-ignore-verse-touch
      initial={false}
      animate={{
        backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0)',
        backdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
      }}
      transition={{
        backgroundColor: { duration: shouldReduceMotion ? 0 : 0.38 },
        backdropFilter: { duration: shouldReduceMotion ? 0 : 0.2 },
      }}
      onClick={isOpen ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        overflow: 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        touchAction: isOpen ? 'pan-y' : 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitBackdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
      }}
    >
      {isOpen && (
        <m.div
          layoutScroll
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            boxSizing: 'border-box',
            padding:
              'max(30px, calc(var(--safe-area-top, 0px) + 14px)) 18px max(220px, calc(var(--safe-area-bottom, 0px) + 180px))',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            style={{
              display: 'grid',
              minHeight: '100%',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              alignContent: entities.length <= 6 ? 'center' : 'start',
              alignItems: 'start',
              gap: '20px 12px',
            }}
          >
            {entities.map(entity => {
              const index = itemIndexes.get(entity.uniqueName) ?? 0
              const isAdditionalItem = index >= visibleStackItemCount
              const sourceDelay = isAdditionalItem
                ? 0
                : getOverlaySourceDelay(index, shouldReduceMotion)
              const additionalDelay =
                additionalItemsStartDelay +
                (index - visibleStackItemCount) * OVERLAY_ADDITIONAL_STAGGER_SECONDS
              const itemRevealDelay = isAdditionalItem ? additionalDelay : sourceDelay + 0.18

              return (
                <m.button
                  layout
                  key={entity.uniqueName}
                  className="chapter-entity-button"
                  type="button"
                  aria-label={openEntityLabel.replace('{{name}}', entity.name)}
                  initial={isAdditionalItem ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  whileTap={{ opacity: 0.55, scale: 0.97 }}
                  transition={{
                    layout: { ...spring, delay: sourceDelay },
                    opacity: {
                      delay: isAdditionalItem ? additionalDelay : 0,
                      duration: shouldReduceMotion ? 0 : 0.2,
                    },
                  }}
                  onClick={event => {
                    event.stopPropagation()
                    onSelect(entity.uniqueName)
                  }}
                  style={{
                    minWidth: 0,
                    margin: 0,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    color: colors.default,
                    fontFamily,
                    cursor: 'pointer',
                  }}
                >
                  <m.img
                    layoutId={`chapter-entity-${entity.uniqueName}`}
                    src={getChapterEntityAvatarUri(entity)}
                    alt=""
                    transition={{ layout: { ...spring, delay: sourceDelay } }}
                    style={{
                      display: 'block',
                      width: 68,
                      height: 68,
                      margin: '0 auto 8px',
                      border: `2px solid ${colors.reverse}`,
                      borderRadius: 36,
                      boxShadow: '0 5px 16px rgba(0, 0, 0, 0.2)',
                      objectFit: 'contain',
                    }}
                  />
                  <m.div
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: itemRevealDelay,
                      duration: shouldReduceMotion ? 0 : 0.18,
                    }}
                  >
                    <span
                      style={{
                        display: '-webkit-box',
                        overflow: 'hidden',
                        color: colors.default,
                        fontFamily,
                        fontSize: 13,
                        lineHeight: 1.22,
                        fontWeight: 650,
                        textAlign: 'center',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                      }}
                    >
                      {entity.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 3,
                        color: colors.default,
                        fontFamily,
                        fontSize: 10,
                        lineHeight: 1.2,
                        fontWeight: 500,
                        textAlign: 'center',
                        opacity: 0.55,
                      }}
                    >
                      {groupLabels[entity.category]}
                    </span>
                  </m.div>
                </m.button>
              )
            })}
          </div>
        </m.div>
      )}
    </m.div>,
    document.body
  )
}

export default ChapterEntitiesOverlay
