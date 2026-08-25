import type { DownloadItemState } from '~state/downloadQueue'

export type DownloadQueueDecision = {
  next?: DownloadItemState
  blocked?: DownloadItemState
}

export const getDownloadQueueDecision = (
  states: Map<string, DownloadItemState>,
  isOnline = true
): DownloadQueueDecision => {
  const queued = Array.from(states.values()).filter(state => state.status === 'queued')
  const blocked = queued.find(state => {
    const { dependsOnId } = state.item
    const dependency = dependsOnId ? states.get(dependsOnId) : undefined
    return dependency?.status === 'failed' || dependency?.status === 'cancelled'
  })
  if (blocked) return { blocked }
  if (!isOnline) return {}

  const next = queued.find(state => {
    const { dependsOnId } = state.item
    if (!dependsOnId) return true
    const dependency = states.get(dependsOnId)
    return !dependency || dependency.status === 'completed'
  })
  return { next }
}
