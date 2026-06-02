import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RelationEndpoint } from './domain'
import { serializeRelationEndpoint } from './routeParams'

export const useOpenEntityRelations = () => {
  const pushRouteOnce = usePushRouteOnce()

  return (endpoint: RelationEndpoint) => {
    pushRouteOnce({
      pathname: '/entity-relations',
      params: {
        endpoint: serializeRelationEndpoint(endpoint),
      },
    })
  }
}
