import Feather from '@expo/vector-icons/Feather'
import type { CSSProperties } from 'react'

import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntityCategory,
} from '~features/resources/strongLexiconAccess'
import {
  getStrongEntityAvatarKey,
  type StrongEntityPresentationKind,
} from '~features/lexique/strongEntityPresentation'
import { ENTITY_AVATAR_IMAGES } from '~features/lexique/strongEntityAvatars'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { BibleDOMDownloadState, RootStyles } from './BibleDOMWrapper'
import { getChapterEntitiesViewMode } from './chapterEntitiesPresentation'

type RasterAsset = string | { uri?: string; default?: string }

const resolveRasterAssetUri = (source: RasterAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

const GROUP_ORDER: StrongLexiconEntityCategory[] = [
  'supernatural',
  'person',
  'place',
  'group',
  'other',
]

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
  onOpenEntity,
  onDownload,
  onDismiss,
}: Props) => {
  const viewMode = getChapterEntitiesViewMode(availabilityStatus, loaded, entities.length)
  if (viewMode === 'hidden') return null

  const colors = settings.colors[settings.theme]
  const isDownloading = ['queued', 'downloading', 'inserting'].includes(downloadState.status ?? '')
  const progress = Math.max(0, Math.min(1, downloadState.progress))
  const sectionStyle: CSSProperties = {
    direction: 'ltr',
    marginTop: 44,
    paddingTop: 28,
    borderTop: `1px solid ${colors.border}`,
    fontFamily: settings.fontFamily,
    textAlign: 'left',
  }
  const titleStyle: CSSProperties = {
    margin: 0,
    color: colors.default,
    fontFamily: settings.fontFamily,
    fontSize: 22,
    lineHeight: 1.25,
    fontWeight: 700,
  }

  return (
    <section style={sectionStyle} aria-label={translations.title}>
      <h2 style={titleStyle}>{translations.title}</h2>
      {viewMode === 'download' && (
        <div
          style={{
            position: 'relative',
            marginTop: 20,
            padding: 14,
            border: `1px dashed ${colors.border}`,
            borderRadius: 14,
            background: colors.reverse,
            opacity: 0.5,
          }}
        >
          <button
            type="button"
            className="chapter-entity-button"
            disabled={isDownloading}
            onClick={onDownload}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: 12,
              margin: 0,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: colors.default,
              textAlign: 'left',
              cursor: isDownloading ? 'default' : 'pointer',
            }}
          >
            <span className={isDownloading ? 'chapter-entity-loader' : undefined}>
              <Feather name={isDownloading ? 'loader' : 'download-cloud'} size={25} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  fontFamily: settings.fontFamily,
                  fontSize: 14,
                  lineHeight: 1.25,
                }}
              >
                {translations.downloadTitle}
              </strong>
              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  color: colors.tertiary,
                  fontFamily: settings.fontFamily,
                  fontSize: 12,
                  lineHeight: 1.35,
                }}
              >
                {isDownloading
                  ? `${translations.downloading} ${Math.round(progress * 100)}%`
                  : downloadState.status === 'failed'
                    ? translations.downloadFailed
                    : translations.downloadDescription}
              </span>
            </span>
          </button>
          {!isDownloading && (
            <button
              type="button"
              className="chapter-entity-button"
              onClick={onDismiss}
              aria-label={translations.dismiss}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'grid',
                width: 30,
                height: 30,
                placeItems: 'center',
                margin: 0,
                padding: 0,
                border: 0,
                borderRadius: 15,
                background: colors.reverse,
                color: colors.default,
                cursor: 'pointer',
              }}
            >
              <Feather name="x" size={18} />
            </button>
          )}
          {isDownloading && (
            <div
              style={{
                height: 4,
                marginTop: 12,
                overflow: 'hidden',
                borderRadius: 2,
                background: colors.border,
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: colors.primary,
                  transition: 'width 180ms ease-out',
                }}
              />
            </div>
          )}
        </div>
      )}
      {viewMode === 'empty' && (
        <p style={{ margin: '16px 0 0', color: colors.tertiary, fontSize: 14 }}>
          {translations.empty}
        </p>
      )}
      {viewMode === 'entities' &&
        GROUP_ORDER.map(group => {
          const groupEntities = entities.filter(entity => entity.category === group)
          if (!groupEntities.length) return null

          return (
            <div key={group} style={{ marginTop: 24 }}>
              <h3
                style={{
                  margin: '0 0 14px',
                  color: colors.primary,
                  fontFamily: settings.fontFamily,
                  fontSize: 12,
                  lineHeight: 1.2,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {translations.groups[group]}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 12px' }}>
                {groupEntities.map(entity => {
                  const presentationKind: StrongEntityPresentationKind =
                    entity.category === 'supernatural' ? 'other' : entity.category
                  const avatar = getStrongEntityAvatarKey(presentationKind, entity.type)
                  const accessibilityLabel = translations.openEntity.replace(
                    '{{name}}',
                    entity.name
                  )

                  return (
                    <button
                      key={entity.uniqueName}
                      className="chapter-entity-button"
                      type="button"
                      onClick={() => onOpenEntity(entity.uniqueName)}
                      aria-label={accessibilityLabel}
                      style={{
                        width: 78,
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
                        src={resolveRasterAssetUri(ENTITY_AVATAR_IMAGES[avatar])}
                        alt=""
                        style={{
                          display: 'block',
                          width: 62,
                          height: 62,
                          margin: '0 auto 7px',
                          borderRadius: 31,
                          objectFit: 'contain',
                        }}
                      />
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          color: colors.default,
                          fontFamily: settings.fontFamily,
                          fontSize: 13,
                          lineHeight: 1.25,
                          fontWeight: 600,
                          textAlign: 'center',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entity.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
    </section>
  )
}

export default ChapterEntities
