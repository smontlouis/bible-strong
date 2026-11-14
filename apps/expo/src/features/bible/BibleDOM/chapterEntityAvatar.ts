import type { EntityPortraitSources } from '~features/lexique/entityPortraits'
import { getStrongEntityPlaceholderSource } from '~features/lexique/strongEntityAvatars'
import type { StrongEntityPresentationKind } from '~features/lexique/strongEntityPresentation'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import type { SyntheticEvent } from 'react'

/** The side of a chapter's avatar, inside its 2-point white contour. */
export const CHAPTER_ENTITY_AVATAR_SIZE = 62
/** The contour of a chapter's avatar, drawn outside its side. */
export const CHAPTER_ENTITY_AVATAR_BORDER = 2

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
  portraits: EntityPortraitSources
) => {
  const placeholder = getChapterEntityPlaceholderUri(entity)
  return {
    src: portraits[entity.uniqueName] ?? placeholder,
    // The entities close the chapter: their pictures wait until the reader comes near them.
    loading: 'lazy' as const,
    decoding: 'async' as const,
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      // The attribute, not `src`, which is absolute: a placeholder that fails must not load again.
      if (event.currentTarget.getAttribute('src') !== placeholder) {
        event.currentTarget.src = placeholder
      }
    },
  }
}

/** A light shadow that lifts a thumbnail and shows its white contour on the page. */
export const CHAPTER_ENTITY_AVATAR_SHADOW =
  '0 1px 2px rgba(16, 27, 53, 0.12), 0 3px 10px rgba(16, 27, 53, 0.10)'
