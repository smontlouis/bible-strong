import type { RelationEndpoint } from './domain'
import { normalizeRelationEndpoint } from './domain'

export const serializeRelationEndpoint = (endpoint: RelationEndpoint): string =>
  JSON.stringify(endpoint)

/** The page listing the Relations of a study object. */
export const getEntityRelationsRoute = (endpoint: RelationEndpoint) => ({
  pathname: '/entity-relations' as const,
  params: {
    endpoint: serializeRelationEndpoint(endpoint),
  },
})

export const parseRelationEndpointParam = (
  endpointParam: string | string[] | undefined
): RelationEndpoint | null => {
  const serialized = Array.isArray(endpointParam) ? endpointParam[0] : endpointParam
  if (!serialized) return null

  try {
    const parsed = JSON.parse(serialized)
    return normalizeRelationEndpoint(parsed)
  } catch {
    return null
  }
}
