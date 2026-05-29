import type { Link } from '~redux/modules/user'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { createVerseEndpoint, normalizeRelationEndpoint, type RelationEndpoint } from './domain'

type EndpointOf<Type extends RelationEndpoint['type']> = Extract<RelationEndpoint, { type: Type }>

export { createVerseEndpoint }

export const createNoteEndpoint = (noteId: string, labelFallback?: string): EndpointOf<'note'> =>
  normalizeRelationEndpoint({ type: 'note', noteId, labelFallback }) as EndpointOf<'note'>

export const createStudyEndpoint = (studyId: string, labelFallback?: string): EndpointOf<'study'> =>
  normalizeRelationEndpoint({ type: 'study', studyId, labelFallback }) as EndpointOf<'study'>

export const createStrongEndpoint = ({
  language,
  code,
  labelFallback,
  originalWord,
}: {
  language: 'greek' | 'hebrew'
  code: string | number
  labelFallback?: string
  originalWord?: string
}): EndpointOf<'strong'> =>
  normalizeRelationEndpoint({
    type: 'strong',
    language,
    code: String(code),
    labelFallback,
    originalWord,
  }) as EndpointOf<'strong'>

export const createNaveEndpoint = ({
  nameLower,
  labelFallback,
  resourceLanguage,
}: {
  nameLower: string
  labelFallback?: string
  resourceLanguage?: ResourceLanguage
}): EndpointOf<'nave'> =>
  normalizeRelationEndpoint({
    type: 'nave',
    nameLower,
    labelFallback,
    resourceLanguage,
  }) as EndpointOf<'nave'>

export const createDictionaryEndpoint = ({
  word,
  labelFallback,
  resourceLanguage,
}: {
  word: string
  labelFallback?: string
  resourceLanguage?: ResourceLanguage
}): EndpointOf<'dictionary'> =>
  normalizeRelationEndpoint({
    type: 'dictionary',
    word,
    labelFallback,
    resourceLanguage,
  }) as EndpointOf<'dictionary'>

export const createWordEndpoint = ({
  word,
  labelFallback,
  resourceLanguage,
}: {
  word: string
  labelFallback?: string
  resourceLanguage?: ResourceLanguage
}): EndpointOf<'word'> =>
  normalizeRelationEndpoint({
    type: 'word',
    word,
    labelFallback,
    resourceLanguage,
  }) as EndpointOf<'word'>

export const createExternalLinkEndpoint = ({
  linkId,
  url,
  labelFallback,
  sourceKey = '',
}: {
  linkId: string
  url: string
  labelFallback?: string
  sourceKey?: string
}): EndpointOf<'externalLink'> =>
  normalizeRelationEndpoint({
    type: 'externalLink',
    linkId,
    sourceKey,
    url,
    labelFallback,
  }) as EndpointOf<'externalLink'>

export const createExternalLinkEndpointFromLink = (
  linkId: string,
  link: Pick<Link, 'url' | 'customTitle' | 'ogData'>,
  sourceKey = ''
): EndpointOf<'externalLink'> =>
  createExternalLinkEndpoint({
    linkId,
    sourceKey,
    url: link.url,
    labelFallback: link.customTitle || link.ogData?.title || link.url,
  })
