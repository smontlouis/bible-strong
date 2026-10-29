// surface-allow: a light shadow under the chapter's thumbnails shows their white contour on the page
import Feather from '@expo/vector-icons/Feather'
import { LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'

import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntityCategory,
} from '~features/resources/strongLexiconAccess'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { BibleDOMDownloadState, RootStyles } from './BibleDOMWrapper'
import ChapterEntitiesOverlay from './ChapterEntitiesOverlay'
import { CHAPTER_ENTITY_AVATAR_SHADOW, getChapterEntityAvatar } from './chapterEntityAvatar'
import {
  getEntityAvatarRadius,
  getEntityPortraitGround,
  type EntityPortraitSources,
} from '~features/lexique/entityPortraits'
import { getChapterEntitiesViewMode, splitChapterEntities } from './chapterEntitiesPresentation'
import { useBibleOverlayOpen } from './overlayLifecycle'
import { getOverlayLayoutTransition } from './overlayStagger'
import { isDarkTheme } from './utils'

const MAX_STACKED_ENTITIES = 3
const AVATAR_SIZE = 62

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
  portraits: EntityPortraitSources
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
  portraits,
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
  const shouldReduceMotion = useReducedMotion()
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  useBibleOverlayOpen(isOverlayOpen)
  const viewMode = getChapterEntitiesViewMode(availabilityStatus, loaded, entities.length)
  if (viewMode === 'hidden' && !chapterResources) return null

  const colors = settings.colors[settings.theme]
  const portraitGround = getEntityPortraitGround(isDarkTheme(settings.theme), colors)
  const isDownloading = ['queued', 'downloading', 'inserting'].includes(downloadState.status ?? '')
  const progress = Math.max(0, Math.min(1, downloadState.progress))
  const { painted, stacked } = splitChapterEntities(entities, portraits)
  const showsPainted = viewMode === 'entities' && painted.length > 0
  const showsStack = viewMode === 'entities' && stacked.length > 0
  const stackedEntities = stacked.slice(0, MAX_STACKED_ENTITIES)
  const layoutTransition = getOverlayLayoutTransition(shouldReduceMotion)
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
      {showsPainted && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px 10px',
            marginTop: 20,
          }}
        >
          {painted.map(entity => (
            <m.button
              key={entity.uniqueName}
              type="button"
              className="chapter-entity-button"
              data-ignore-verse-touch
              aria-label={translations.openEntity.replace('{{name}}', entity.name)}
              whileTap={{ opacity: 0.55, scale: 0.97 }}
              onClick={() => onOpenEntity(entity.uniqueName)}
              style={{
                width: 74,
                margin: 0,
                padding: 0,
                border: 0,
                background: 'transparent',
                color: colors.default,
                fontFamily: settings.fontFamily,
                cursor: 'pointer',
              }}
            >
              <img
                {...getChapterEntityAvatar(entity, portraits)}
                alt=""
                style={{
                  display: 'block',
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  margin: '0 auto 6px',
                  border: `2px solid ${colors.reverse}`,
                  borderRadius: getEntityAvatarRadius(AVATAR_SIZE),
                  background: portraitGround,
                  boxShadow: CHAPTER_ENTITY_AVATAR_SHADOW,
                  objectFit: 'cover',
                }}
              />
              <span
                style={{
                  display: '-webkit-box',
                  overflow: 'hidden',
                  fontSize: 12,
                  lineHeight: 1.22,
                  fontWeight: 600,
                  textAlign: 'center',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                }}
              >
                {entity.name}
              </span>
            </m.button>
          ))}
        </div>
      )}
      {(viewMode === 'download' || showsStack || chapterResources) && (
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
                    borderRadius: getEntityAvatarRadius(62),
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
                    border: 0,
                    borderRadius: '50%',
                    // A neutral tint, like the app's secondary button: no outline, no shadow
                    background: colors.lightGrey,
                    color: colors.tertiary,
                    cursor: 'pointer',
                  }}
                >
                  <Feather name="x" size={14} />
                </button>
              )}
            </div>
          )}
          {showsStack && (
            <LayoutGroup id={layoutGroupId}>
              <m.button
                layoutDependency={isOverlayOpen}
                type="button"
                className="chapter-entity-button"
                data-ignore-verse-touch
                aria-label={stacked.map(entity => entity.name).join(', ')}
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
                    stackedEntities.length <= 1 ? 0 : (index / (stackedEntities.length - 1)) * 2 - 1

                  return (
                    <m.img
                      key={entity.uniqueName}
                      layoutId={`chapter-entity-${entity.uniqueName}`}
                      layoutDependency={isOverlayOpen}
                      {...getChapterEntityAvatar(entity, portraits)}
                      alt=""
                      transition={{ layout: layoutTransition }}
                      style={{
                        gridArea: '1 / 1',
                        display: 'block',
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        placeSelf: 'center',
                        border: `2px solid ${colors.reverse}`,
                        borderRadius: getEntityAvatarRadius(AVATAR_SIZE),
                        background: portraitGround,
                        boxShadow: CHAPTER_ENTITY_AVATAR_SHADOW,
                        objectFit: 'cover',
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
                entities={stacked}
                portraits={portraits}
                groupLabels={translations.groups}
                openEntityLabel={translations.openEntity}
                colors={colors}
                portraitGround={portraitGround}
                fontFamily={settings.fontFamily}
                visibleStackItemCount={stackedEntities.length}
                isOpen={isOverlayOpen}
                onClose={() => setIsOverlayOpen(false)}
                onSelect={uniqueName => {
                  onOpenEntity(uniqueName)
                }}
              />
            </LayoutGroup>
          )}
          {chapterResources}
        </div>
      )}
    </section>
  )
}

export default ChapterEntities
