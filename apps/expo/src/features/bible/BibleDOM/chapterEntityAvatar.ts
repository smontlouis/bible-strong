import { getEntityPortraitUri, type EntityPortraitHashes } from '~features/lexique/entityPortraits'
import { getStrongEntityPlaceholderSource } from '~features/lexique/strongEntityAvatars'
import type { StrongEntityPresentationKind } from '~features/lexique/strongEntityPresentation'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import type { SyntheticEvent } from 'react'

type RasterAsset = string | { uri?: string; default?: string }

const resolveRasterAssetUri = (source: RasterAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

const getChapterEntityPlaceholderUri = (entity: StrongLexiconChapterEntity) => {
  const presentationKind: StrongEntityPresentationKind =
    entity.category === 'supernatural' ? 'other' : entity.category
  return resolveRasterAssetUri(
    getStrongEntityPlaceholderSource(presentationKind, entity.type, entity.uniqueName)
  )
}

/**
 * The portrait of a chapter's entity, or its placeholder (ADR-0089). The image falls back to the
 * placeholder when the portrait cannot be loaded.
 */
export const getChapterEntityAvatar = (
  entity: StrongLexiconChapterEntity,
  portraits: EntityPortraitHashes
) => {
  const placeholder = getChapterEntityPlaceholderUri(entity)
  const hash = portraits[entity.uniqueName]
  return {
    src: hash ? getEntityPortraitUri(entity.uniqueName, hash) : placeholder,
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      if (event.currentTarget.src !== placeholder) event.currentTarget.src = placeholder
    },
  }
}
