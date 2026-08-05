import Feather from '@expo/vector-icons/Feather'
import { domMax, LayoutGroup, LazyMotion, m, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'

import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntityCategory,
} from '~features/resources/strongLexiconAccess'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { BibleDOMDownloadState, RootStyles } from './BibleDOMWrapper'
import ChapterEntitiesOverlay, { getChapterEntityAvatarUri } from './ChapterEntitiesOverlay'
import { getChapterEntitiesViewMode } from './chapterEntitiesPresentation'
import { SET_BIBLE_OVERLAY_OPEN } from './dispatch'
import { useDispatch } from './DispatchProvider'

const MAX_STACKED_ENTITIES = 3

type ChapterEntityTranslations = {
  title: string
  groups: Record<StrongLexiconEntityCategory, string>
  openEntity: string
  empty: string
  downloadTitle: string
  downloadDescription: string
  downloading: string
  downloadFailed: string
  dismiss: string
}

type Props = RootStyles & {
  entities: StrongLexiconChapterEntity[]
  loaded: boolean
  availabilityStatus: StrongLexiconModuleAvailability['status'] | null
  downloadState: BibleDOMDownloadState
  translations: ChapterEntityTranslations
  chapterResources?: ReactNode
  onOpenEntity: (uniqueName: string) => void
  onDownload: () => void
  onDismiss: () => void
}

const ChapterEntities = ({
  entities,
  loaded,
  availabilityStatus,
  downloadState,
  settings,
  translations,
  chapterResources,
  onOpenEntity,
  onDownload,
  onDismiss,
}: Props) => {
  const layoutGroupId = useId()
  const dispatch = useDispatch()
  const shouldReduceMotion = useReducedMotion()
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  useEffect(() => {
    if (!isOverlayOpen) return

    void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: true })
    return () => {
      void dispatch({ type: SET_BIBLE_OVERLAY_OPEN, payload: false })
    }
  }, [dispatch, isOverlayOpen])
  const viewMode = getChapterEntitiesViewMode(availabilityStatus, loaded, entities.length)
  if (viewMode === 'hidden' && !chapterResources) return null

  const colors = settings.colors[settings.theme]
  const isDownloading = ['queued', 'downloading', 'inserting'].includes(downloadState.status ?? '')
  const progress = Math.max(0, Math.min(1, downloadState.progress))
  const stackedEntities = entities.slice(0, MAX_STACKED_ENTITIES)
  const sectionStyle: CSSProperties = {
    direction: 'ltr',
    marginTop: 64,
    fontFamily: settings.fontFamily,
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }
  const titleStyle: CSSProperties = {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: colors.tertiary,
    fontFamily: settings.fontFamily,
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.62,
  }
  const dividerStyle: CSSProperties = {
    flex: 1,
    height: 1,
    background: `linear-gradient(to right, transparent, ${colors.border})`,
  }

  return (
    <section style={sectionStyle} aria-label={translations.title}>
      <h2 style={titleStyle}>
        <span aria-hidden style={dividerStyle} />
        <span>{translations.title}</span>
        <span
          aria-hidden
          style={{
            ...dividerStyle,
            background: `linear-gradient(to left, transparent, ${colors.border})`,
          }}
        />
      </h2>
      {viewMode === 'empty' && (
        <p style={{ margin: '16px 0 0', color: colors.tertiary, fontSize: 14 }}>
          {translations.empty}
        </p>
      )}
      {(viewMode === 'download' || viewMode === 'entities' || chapterResources) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 38,
            marginTop: 20,
          }}
        >
          {viewMode === 'download' && (
            <div
              style={{
                position: 'relative',
                display: 'flex',
                width: 82,
                flexDirection: 'column',
                alignItems: 'center',
                alignSelf: 'flex-start',
              }}
            >
              <button
                type="button"
                className="chapter-entity-button"
                disabled={isDownloading}
                onClick={onDownload}
                aria-label={
                  isDownloading
                    ? `${translations.downloading} ${Math.round(progress * 100)}%`
                    : translations.downloadTitle
                }
                style={{
                  display: 'flex',
                  width: 82,
                  flexDirection: 'column',
                  alignItems: 'center',
                  margin: 0,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: colors.default,
                  cursor: isDownloading ? 'default' : 'pointer',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    width: 62,
                    height: 62,
                    placeItems: 'center',
                    border: `2px dashed ${colors.border}`,
                    borderRadius: 33,
                    background: colors.reverse,
                    color: colors.tertiary,
                  }}
                >
                  <span className={isDownloading ? 'chapter-entity-loader' : undefined}>
                    <Feather
                      name={isDownloading ? 'loader' : 'download-cloud'}
                      size={25}
                      color={colors.tertiary}
                    />
                  </span>
                </span>
                <strong
                  style={{
                    display: '-webkit-box',
                    width: '100%',
                    marginTop: 7,
                    overflow: 'hidden',
                    color: colors.tertiary,
                    fontFamily: settings.fontFamily,
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    textAlign: 'center',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                >
                  {translations.downloadTitle}
                </strong>
                {(isDownloading || downloadState.status === 'failed') && (
                  <span
                    style={{
                      marginTop: 3,
                      color: colors.tertiary,
                      fontFamily: settings.fontFamily,
                      fontSize: 9,
                      lineHeight: 1.15,
                      textAlign: 'center',
                    }}
                  >
                    {isDownloading ? `${Math.round(progress * 100)}%` : translations.downloadFailed}
                  </span>
                )}
              </button>
              {!isDownloading && (
                <button
                  type="button"
                  className="chapter-entity-button"
                  onClick={onDismiss}
                  aria-label={translations.dismiss}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: 0,
                    display: 'grid',
                    width: 24,
                    height: 24,
                    placeItems: 'center',
                    margin: 0,
                    padding: 0,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    background: colors.reverse,
                    color: colors.tertiary,
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.14)',
                    cursor: 'pointer',
                  }}
                >
                  <Feather name="x" size={14} />
                </button>
              )}
            </div>
          )}
          {viewMode === 'entities' && (
            <LazyMotion features={domMax} strict>
              <LayoutGroup id={layoutGroupId}>
                <m.button
                  type="button"
                  className="chapter-entity-button"
                  data-ignore-verse-touch
                  aria-label={entities.map(entity => entity.name).join(', ')}
                  whileTap={{ opacity: 0.55 }}
                  onClick={() => setIsOverlayOpen(true)}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    width: 78,
                    height: 70,
                    margin: 0,
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    isolation: 'isolate',
                  }}
                >
                  {stackedEntities.map((entity, index) => {
                    const position =
                      stackedEntities.length <= 1
                        ? 0
                        : (index / (stackedEntities.length - 1)) * 2 - 1

                    return (
                      <m.img
                        key={entity.uniqueName}
                        layoutId={`chapter-entity-${entity.uniqueName}`}
                        src={getChapterEntityAvatarUri(entity)}
                        alt=""
                        transition={{
                          layout: shouldReduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 360, damping: 34, mass: 0.8 },
                        }}
                        style={{
                          gridArea: '1 / 1',
                          display: 'block',
                          width: 62,
                          height: 62,
                          placeSelf: 'center',
                          border: `2px solid ${colors.reverse}`,
                          borderRadius: 33,
                          boxShadow: '0 2px 7px rgba(0, 0, 0, 0.22)',
                          objectFit: 'contain',
                          x: position * 6,
                          y: Math.abs(position) * 2,
                          rotate: position * 5,
                          transformOrigin: 'center',
                          zIndex: index + 1,
                        }}
                      />
                    )
                  })}
                </m.button>
                <ChapterEntitiesOverlay
                  entities={entities}
                  groupLabels={translations.groups}
                  openEntityLabel={translations.openEntity}
                  colors={colors}
                  fontFamily={settings.fontFamily}
                  visibleStackItemCount={stackedEntities.length}
                  isOpen={isOverlayOpen}
                  onClose={() => setIsOverlayOpen(false)}
                  onSelect={uniqueName => {
                    onOpenEntity(uniqueName)
                  }}
                />
              </LayoutGroup>
            </LazyMotion>
          )}
          {chapterResources}
        </div>
      )}
    </section>
  )
}

export default ChapterEntities
