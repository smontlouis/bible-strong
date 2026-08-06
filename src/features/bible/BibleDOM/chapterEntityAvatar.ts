import { ENTITY_AVATAR_IMAGES } from '~features/lexique/strongEntityAvatars'
import {
  getStrongEntityAvatarKey,
  type StrongEntityPresentationKind,
} from '~features/lexique/strongEntityPresentation'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'

type RasterAsset = string | { uri?: string; default?: string }

const resolveRasterAssetUri = (source: RasterAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

export const getChapterEntityAvatarUri = (entity: StrongLexiconChapterEntity) => {
  const presentationKind: StrongEntityPresentationKind =
    entity.category === 'supernatural' ? 'other' : entity.category
  const avatar = getStrongEntityAvatarKey(presentationKind, entity.type)
  return resolveRasterAssetUri(ENTITY_AVATAR_IMAGES[avatar])
}
