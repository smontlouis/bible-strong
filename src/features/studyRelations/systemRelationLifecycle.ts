import type { Link } from '~redux/modules/user'
import {
  createExternalLinkEndpoint,
  createSystemRelation,
  createVerseEndpoint,
  getSystemRelationId,
  type RelationsObj,
} from './domain'

export const groupVerseKeysByChapter = (verseKeys: string[]): string[][] => {
  const groups = verseKeys.reduce(
    (result, verseKey) => {
      const [book, chapter] = verseKey.split('-')
      const groupKey = `${book}-${chapter}`
      result[groupKey] = result[groupKey] || []
      result[groupKey].push(verseKey)
      return result
    },
    {} as Record<string, string[]>
  )

  return Object.values(groups)
}

export const addExternalLinkSystemRelations = ({
  relations = {},
  linkKey,
  link,
  verseKeys,
}: {
  relations?: RelationsObj
  linkKey: string
  link: Link
  verseKeys: string[]
}): RelationsObj => {
  const nextRelations = { ...relations }

  groupVerseKeysByChapter(verseKeys).forEach(verseKeyGroup => {
    const verseEndpoint = createVerseEndpoint(verseKeyGroup, verseKeyGroup.join('/'), link.version)
    const externalLinkEndpoint = createExternalLinkEndpoint(verseEndpoint, linkKey, link)
    const relation = createSystemRelation({
      id: getSystemRelationId('externalLink', linkKey, verseEndpoint),
      type: 'externalLink',
      endpoints: [externalLinkEndpoint, verseEndpoint],
      createdAt: link.date,
      updatedAt: link.date,
    })
    nextRelations[relation.id] = relation
  })

  return nextRelations
}

export const refreshExternalLinkSystemRelations = ({
  relations = {},
  linkKey,
  link,
  updatedAt = Date.now(),
}: {
  relations?: RelationsObj
  linkKey: string
  link: Link
  updatedAt?: number
}): RelationsObj => {
  const nextRelations = { ...relations }

  Object.values(relations).forEach(existingRelation => {
    if (existingRelation.kind !== 'system' || existingRelation.type !== 'externalLink') return

    const linkEndpoint = existingRelation.endpoints.find(
      endpoint => endpoint.type === 'externalLink' && endpoint.linkId === linkKey
    )
    const verseEndpoint = existingRelation.endpoints.find(endpoint => endpoint.type === 'verse')
    if (linkEndpoint?.type !== 'externalLink' || verseEndpoint?.type !== 'verse') return

    const externalLinkEndpoint = createExternalLinkEndpoint(verseEndpoint, linkKey, link)
    nextRelations[existingRelation.id] = createSystemRelation({
      id: existingRelation.id,
      type: 'externalLink',
      endpoints: [externalLinkEndpoint, verseEndpoint],
      createdAt: existingRelation.createdAt || link.date,
      updatedAt,
    })
  })

  return nextRelations
}

export const removeExternalLinkSystemRelations = (
  relations: RelationsObj = {},
  linkKey: string
): RelationsObj => {
  const nextRelations = { ...relations }

  for (const [relationId, relation] of Object.entries(relations)) {
    if (relation.kind !== 'system') continue

    const matches = relation.endpoints.some(
      endpoint => endpoint.type === 'externalLink' && endpoint.linkId === linkKey
    )
    if (matches) {
      delete nextRelations[relationId]
    }
  }

  return nextRelations
}
