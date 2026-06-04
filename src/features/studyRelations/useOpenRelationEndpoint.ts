import type { RelationEndpoint } from './domain'
import { useOpenStudyObject } from './useOpenStudyObject'

export const useOpenRelationEndpoint = () => {
  const openStudyObject = useOpenStudyObject()

  return (endpoint: RelationEndpoint) => {
    openStudyObject({ endpoint })
  }
}
