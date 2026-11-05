import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RelationEndpoint } from './domain'
import { getEntityRelationsRoute } from './routeParams'

export const useOpenEntityRelations = () => {
  const pushRouteOnce = usePushRouteOnce()

  return (endpoint: RelationEndpoint) => {
    pushRouteOnce(getEntityRelationsRoute(endpoint))
  }
}
