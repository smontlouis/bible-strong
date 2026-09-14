interface SelectionSnapshot {
  owner: string
  collectionId: string | null | undefined
}

interface SelectionRequest {
  read: () => SelectionSnapshot
  subscribe: (listener: () => void) => () => void
  prepare: () => Promise<unknown>
  isActive: () => boolean
  commit: () => void
}

/** A late download must never overwrite a newer preference or cross an account transition. */
export const selectDailyCollection = async ({
  read,
  subscribe,
  prepare,
  isActive,
  commit,
}: SelectionRequest): Promise<'selected' | 'cancelled' | 'failed'> => {
  const initial = read()
  let invalidated = false
  const check = () => {
    const current = read()
    if (current.owner !== initial.owner || current.collectionId !== initial.collectionId)
      invalidated = true
  }
  const unsubscribe = subscribe(check)
  try {
    await prepare()
    check()
    if (invalidated || !isActive()) return 'cancelled'
    commit()
    return 'selected'
  } catch {
    return invalidated || !isActive() ? 'cancelled' : 'failed'
  } finally {
    unsubscribe()
  }
}
