import type { FirestoreSyncIntent } from '~helpers/firestoreSyncOutbox'
import type { Study } from './modules/user'

const withoutUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * The write of one study's changes. The content goes whole (rich-text operations do not merge),
 * and the owner always goes along: the rules check it on the written document, so a merge that
 * has to create a study missing on the server is refused without it.
 */
export const createStudySyncIntent = ({
  studyId,
  changes,
  study,
  userId,
}: {
  studyId: string
  changes: unknown
  study: Study | undefined
  userId: string
}): Extract<FirestoreSyncIntent, { kind: 'document-set' }> => ({
  kind: 'document-set',
  path: ['studies', studyId],
  data: {
    ...(withoutUndefined(changes) as Record<string, unknown>),
    content: { ops: study?.content?.ops || [] },
    user: withoutUndefined({ ...study?.user, id: userId }),
  },
  merge: true,
})
