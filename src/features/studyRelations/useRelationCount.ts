import { useSelector } from 'react-redux'

import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import { endpointIdentity, type RelationEndpoint } from './domain'

export const useRelationCount = (endpoint: RelationEndpoint | null) => {
  const countsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)

  if (!endpoint) return 0

  return countsByEndpoint[endpointIdentity(endpoint)] || 0
}
