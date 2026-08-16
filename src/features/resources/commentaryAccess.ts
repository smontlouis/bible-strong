import { onlineManager } from '@tanstack/react-query'

import type { Comment, Comments } from '~features/commentaries/types'
import { firebaseDb } from '~helpers/firebase'
import loadMhyComments from '~helpers/loadMhyComments'
import { getLocalResourceAvailability } from './resourceAvailability'
import {
  mapLocalResourceError,
  ResourceAccessError,
  unwrapLocalResourceResult,
} from './resourceAccessError'

export class CommentaryAccessError extends Error {
  constructor(public readonly code: 'NOT_FOUND') {
    super(code)
    this.name = 'CommentaryAccessError'
  }
}

export type CommentaryAccess = {
  loadVersePage: (verse: string, afterOrder?: number) => Promise<Comments>
}

const mhyIdentity = { kind: 'database', databaseId: 'MHY', language: 'fr' } as const

export const localMhyCommentaryAccess: CommentaryAccess = {
  async loadVersePage(verse, afterOrder) {
    if (afterOrder != null) return { id: verse, count: 1, comments: [] }

    try {
      const availability = await getLocalResourceAvailability(mhyIdentity)
      if (availability.status !== 'available') {
        if (availability.status === 'missing') {
          throw new ResourceAccessError('UNKNOWN', ['acquire-offline-copy'])
        }
        throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      }

      const [book, chapter, verseNumber] = verse.split('-').map(Number)
      if (![book, chapter, verseNumber].every(Number.isSafeInteger)) {
        throw new CommentaryAccessError('NOT_FOUND')
      }

      const row = unwrapLocalResourceResult(await loadMhyComments(book, chapter))
      if (!row) throw new CommentaryAccessError('NOT_FOUND')

      let commentsByVerse: Record<string, unknown>
      try {
        const decoded: unknown = JSON.parse(row.commentaires)
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
          throw new Error('MHY_COMMENTARY_INVALID')
        }
        commentsByVerse = decoded as Record<string, unknown>
      } catch {
        throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      }

      const content = commentsByVerse[String(verseNumber)]
      if (typeof content !== 'string' || !content.trim()) {
        throw new CommentaryAccessError('NOT_FOUND')
      }

      return {
        id: verse,
        count: 1,
        comments: [
          {
            id: `MHY-${verse}`,
            verseId: verse,
            content,
            resource: {
              name: 'Commentaire concis de la Bible',
              code: 'MHY',
              logo: '',
              author: 'Matthew Henry',
            },
            order: 0,
            type: 'comment',
            isSDA: false,
          },
        ],
      }
    } catch (error) {
      if (error instanceof CommentaryAccessError || error instanceof ResourceAccessError)
        throw error
      throw mapLocalResourceError(error)
    }
  },
}

export const firestoreCommentaryAccess: CommentaryAccess = {
  async loadVersePage(verse, afterOrder) {
    try {
      if (afterOrder == null) {
        const verseCommentRef = await firebaseDb.collection('verse-commentaries').doc(verse).get()
        if (!verseCommentRef.exists) throw new CommentaryAccessError('NOT_FOUND')

        const snapshot = await firebaseDb
          .collection('verse-commentaries')
          .doc(verse)
          .collection('commentaries')
          .orderBy('order')
          .where('isSDA', '==', false)
          .limit(3)
          .get()

        return {
          ...(verseCommentRef.data() as Omit<Comments, 'comments'>),
          comments: snapshot.docs.map(document => document.data() as Comment),
        }
      }

      const snapshot = await firebaseDb
        .collection('verse-commentaries')
        .doc(verse)
        .collection('commentaries')
        .orderBy('order')
        .startAfter(afterOrder)
        .limit(8)
        .get()
      return {
        id: verse,
        count: 0,
        comments: snapshot.docs.map(document => document.data() as Comment),
      }
    } catch (error) {
      if (error instanceof CommentaryAccessError) throw error
      throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
    }
  },
}

export const createCommentaryAccess = ({
  isOnline = async () => onlineManager.isOnline(),
  local = localMhyCommentaryAccess,
  remote = firestoreCommentaryAccess,
}: {
  isOnline?: () => Promise<boolean>
  local?: CommentaryAccess
  remote?: CommentaryAccess
} = {}): CommentaryAccess => ({
  async loadVersePage(verse, afterOrder) {
    if (afterOrder != null) {
      if (!(await isOnline())) throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
      return remote.loadVersePage(verse, afterOrder)
    }

    const connected = await isOnline()
    const [localResult, remoteResult] = await Promise.allSettled([
      local.loadVersePage(verse),
      connected
        ? remote.loadVersePage(verse)
        : Promise.reject(new ResourceAccessError('TEMPORARY_UNAVAILABLE')),
    ])

    if (localResult.status === 'fulfilled' && remoteResult.status === 'fulfilled') {
      return {
        id: verse,
        count: localResult.value.count + remoteResult.value.count,
        comments: [...localResult.value.comments, ...remoteResult.value.comments],
      }
    }
    if (localResult.status === 'fulfilled') return localResult.value
    if (remoteResult.status === 'fulfilled') return remoteResult.value

    if (!connected) throw localResult.reason
    if (remoteResult.reason instanceof CommentaryAccessError) {
      if (localResult.reason instanceof CommentaryAccessError) throw remoteResult.reason
      throw localResult.reason
    }
    throw remoteResult.reason instanceof ResourceAccessError
      ? remoteResult.reason
      : new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  },
})

export const defaultCommentaryAccess = createCommentaryAccess()
