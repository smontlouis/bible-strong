import { getBibleVersionMetadata } from '~helpers/biblesDb'
import { storage } from '~helpers/storage'
import { persistor, store } from '~redux/store'
import {
  realignWordAnnotationsAction,
  type WordAnnotationRealignmentUpdate,
} from '~redux/modules/user/wordAnnotations'

const JOURNAL_KEY = 'pendingBibleAnnotationRealignment'

interface AnnotationMigrationJournal {
  versionId: string
  textRevision: string
  updates: Record<string, WordAnnotationRealignmentUpdate>
}

export const persistAnnotationMigrationJournal = (journal: AnnotationMigrationJournal): void => {
  storage.set(JOURNAL_KEY, JSON.stringify(journal))
}

export const clearAnnotationMigrationJournal = (): void => {
  storage.remove(JOURNAL_KEY)
}

export const resumePendingAnnotationMigration = async (): Promise<void> => {
  const raw = storage.getString(JOURNAL_KEY)
  if (!raw) return

  let journal: AnnotationMigrationJournal
  try {
    journal = JSON.parse(raw) as AnnotationMigrationJournal
  } catch {
    clearAnnotationMigrationJournal()
    return
  }

  const metadata = await getBibleVersionMetadata(journal.versionId)
  if (metadata?.textRevision !== journal.textRevision) {
    clearAnnotationMigrationJournal()
    return
  }

  const annotations = store.getState().user.bible.wordAnnotations
  const pendingUpdates = Object.fromEntries(
    Object.entries(journal.updates).filter(([id, changes]) => {
      const annotation = annotations[id]
      if (!annotation) return false
      return (
        (changes.version !== undefined && annotation.version !== changes.version) ||
        annotation.textRevision !== changes.textRevision ||
        JSON.stringify(annotation.ranges) !== JSON.stringify(changes.ranges)
      )
    })
  )
  if (Object.keys(pendingUpdates).length > 0) {
    store.dispatch(realignWordAnnotationsAction(pendingUpdates))
    await persistor.flush()
  }
  clearAnnotationMigrationJournal()
}
