import { useRouter } from 'expo-router'
import type { RelationEndpoint } from './domain'
import { serializeRelationEndpoint } from './routeParams'

export const useOpenEntityRelations = () => {
  const router = useRouter()

  return (endpoint: RelationEndpoint) => {
    router.push({
      pathname: '/entity-relations',
      params: {
        endpoint: serializeRelationEndpoint(endpoint),
      },
    })
  }
}
