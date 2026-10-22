import type { StudyMutation } from '~redux/modules/user/studies'

// Each save writes the whole Study to Firestore: edits are saved after a pause in the typing.
export const STUDY_AUTOSAVE_DELAY_MS = 3000
// Long uninterrupted typing still reaches the store this often, in case the app ends abruptly.
export const STUDY_AUTOSAVE_MAX_WAIT_MS = 15_000

export type StudyContentAutosave = {
  /** Keeps the latest change and saves it after a pause. */
  schedule: (change: StudyMutation) => void
  /** Saves the pending change now, if there is one. */
  flush: () => void
}

export const createStudyContentAutosave = (
  save: (change: StudyMutation) => void,
  { delayMs = STUDY_AUTOSAVE_DELAY_MS, maxWaitMs = STUDY_AUTOSAVE_MAX_WAIT_MS } = {}
): StudyContentAutosave => {
  let pending: StudyMutation | undefined
  let pendingSince = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (!pending) return
    const change = pending
    pending = undefined
    save(change)
  }

  return {
    schedule(change) {
      // The change of another Study does not wait behind this one.
      if (pending && pending.id !== change.id) flush()
      if (!pending) pendingSince = Date.now()
      pending = { ...pending, ...change }
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(
        flush,
        Math.max(0, Math.min(delayMs, pendingSince + maxWaitMs - Date.now()))
      )
    },
    flush,
  }
}
