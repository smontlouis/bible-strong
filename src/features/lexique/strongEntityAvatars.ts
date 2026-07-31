import { getStrongEntityAvatarKey } from './strongEntityPresentation'

const ENTITY_AVATAR_IMAGES = {
  male: require('~assets/images/entity-avatars/male.png'),
  female: require('~assets/images/entity-avatars/female.png'),
  group: require('~assets/images/entity-avatars/group.png'),
  place: require('~assets/images/entity-avatars/place.png'),
  supernatural: require('~assets/images/entity-avatars/supernatural.png'),
  time: require('~assets/images/entity-avatars/time.png'),
  musical: require('~assets/images/entity-avatars/musical.png'),
  other: require('~assets/images/entity-avatars/other.png'),
  title: require('~assets/images/entity-avatars/title.png'),
  language: require('~assets/images/entity-avatars/language.png'),
  star: require('~assets/images/entity-avatars/star.png'),
}

export const getStrongEntityAvatarSource = (category: string, type: string) =>
  ENTITY_AVATAR_IMAGES[getStrongEntityAvatarKey(category, type)]
