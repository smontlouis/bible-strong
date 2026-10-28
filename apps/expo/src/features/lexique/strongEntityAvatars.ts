import { getEntityPlaceholderIndex } from './entityPortraits'
import { getStrongEntityAvatarKey, type StrongEntityAvatarKey } from './strongEntityPresentation'

// Grey clay figures for the entities without a portrait (ADR-0089): five for people and groups, so that
// neighbours in a chapter differ, one for the other avatar keys.
export const ENTITY_PLACEHOLDER_IMAGES = {
  male: [
    require('~assets/images/entity-avatars/male-1.webp'),
    require('~assets/images/entity-avatars/male-2.webp'),
    require('~assets/images/entity-avatars/male-3.webp'),
    require('~assets/images/entity-avatars/male-4.webp'),
    require('~assets/images/entity-avatars/male-5.webp'),
  ],
  female: [
    require('~assets/images/entity-avatars/female-1.webp'),
    require('~assets/images/entity-avatars/female-2.webp'),
    require('~assets/images/entity-avatars/female-3.webp'),
    require('~assets/images/entity-avatars/female-4.webp'),
    require('~assets/images/entity-avatars/female-5.webp'),
  ],
  group: [
    require('~assets/images/entity-avatars/group-1.webp'),
    require('~assets/images/entity-avatars/group-2.webp'),
    require('~assets/images/entity-avatars/group-3.webp'),
    require('~assets/images/entity-avatars/group-4.webp'),
    require('~assets/images/entity-avatars/group-5.webp'),
  ],
  place: [require('~assets/images/entity-avatars/place-1.webp')],
  supernatural: [require('~assets/images/entity-avatars/supernatural-1.webp')],
  time: [require('~assets/images/entity-avatars/time-1.webp')],
  musical: [require('~assets/images/entity-avatars/musical-1.webp')],
  other: [require('~assets/images/entity-avatars/other-1.webp')],
  title: [require('~assets/images/entity-avatars/title-1.webp')],
  language: [require('~assets/images/entity-avatars/language-1.webp')],
  star: [require('~assets/images/entity-avatars/star-1.webp')],
} satisfies Record<StrongEntityAvatarKey, unknown[]>

/** The placeholder of an entity, the same wherever it is drawn. `seed` is its unique name. */
export const getStrongEntityPlaceholderSource = (category: string, type: string, seed: string) => {
  const images = ENTITY_PLACEHOLDER_IMAGES[getStrongEntityAvatarKey(category, type)]
  return images[getEntityPlaceholderIndex(seed, images.length)]
}
