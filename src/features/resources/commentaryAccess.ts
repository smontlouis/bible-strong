import { onlineManager } from '@tanstack/react-query'

import type { Comment, Comments } from '~features/commentaries/types'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { firebaseDb } from '~helpers/firebase'
import loadMhyComments from '~helpers/loadMhyComments'
import { getLocalResourceAvailability } from './resourceAvailability'
import { Schema } from 'effect'
import { CommentaryVerseResponseDto } from './supplementaryContract'
import {
  mapLocalResourceError,
  ResourceAccessError,
  resourceAccessErrorFromHttpResponse,
  unwrapLocalResourceResult,
} from './resourceAccessError'

export class CommentaryAccessError extends Error {
  constructor(public readonly code: 'NOT_FOUND') {
    super(code)
    this.name = 'CommentaryAccessError'
  }
}

export type CommentaryAccess = {
  loadVersePage: (
    verse: string,
    afterOrder?: number,
    language?: ResourceLanguage
  ) => Promise<Comments>
}

const mhyIdentity = { kind: 'database', databaseId: 'MHY', language: 'fr' } as const

export const localMhyCommentaryAccess: CommentaryAccess = {
  async loadVersePage(verse, afterOrder) {
    if (afterOrder != null) return { id: verse, count: 1, comments: [] }

    try {
      const availability = await getLocalResourceAvailability(mhyIdentity)
      if (availability.status !== 'available') {
        if (availability.status === 'missing') {
          throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
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

type HttpCommentaryAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

export const createHttpCommentaryAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 8_000,
}: HttpCommentaryAccessOptions): CommentaryAccess => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const loadVersePage = async (verse: string, afterOrder?: number): Promise<Comments> => {
    if (afterOrder != null) return { id: verse, count: 1, comments: [] }
    if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/commentaries/MHY/fr/verses/${encodeURIComponent(verse)}`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
      )
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        if (response.status === 404 && code === 'SUPPLEMENTARY_CONTENT_NOT_FOUND') {
          throw new CommentaryAccessError('NOT_FOUND')
        }
        throw resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
      }
      let decoded: Schema.Schema.Type<typeof CommentaryVerseResponseDto>
      try {
        decoded = Schema.decodeUnknownSync(CommentaryVerseResponseDto)(payload)
      } catch {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      if (decoded.verseKey !== verse || decoded.resource.resourceId !== 'MHY') {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      return {
        id: verse,
        count: 1,
        comments: [
          {
            id: `MHY-${verse}`,
            verseId: verse,
            content: decoded.content,
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
      if (error instanceof CommentaryAccessError || error instanceof ResourceAccessError) {
        throw error
      }
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
  return { loadVersePage }
}

export const createCommentaryAccess = ({
  isOnline = async () => onlineManager.isOnline(),
  local = localMhyCommentaryAccess,
  remote = firestoreCommentaryAccess,
  combineResults = true,
}: {
  isOnline?: () => Promise<boolean>
  local?: CommentaryAccess
  remote?: CommentaryAccess
  combineResults?: boolean
} = {}): CommentaryAccess => ({
  async loadVersePage(verse, afterOrder, language = 'fr') {
    if (language !== 'fr') {
      if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
      return remote.loadVersePage(verse, afterOrder, language)
    }

    if (afterOrder != null) {
      if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
      return remote.loadVersePage(verse, afterOrder, language)
    }

    const connected = await isOnline()
    if (!combineResults) {
      try {
        return await local.loadVersePage(verse, undefined, language)
      } catch (localError) {
        if (!connected) {
          if (
            localError instanceof ResourceAccessError &&
            ['INVALID_OFFLINE_COPY', 'INTEGRITY_FAILURE'].includes(localError.code)
          ) {
            throw localError
          }
          throw new ResourceAccessError('NETWORK_OFFLINE', ['retry', 'acquire-offline-copy'])
        }
        try {
          return await remote.loadVersePage(verse, undefined, language)
        } catch (remoteError) {
          if (remoteError instanceof CommentaryAccessError) throw remoteError
          throw remoteError
        }
      }
    }
    if (!connected) {
      try {
        return await local.loadVersePage(verse)
      } catch (error) {
        if (
          error instanceof ResourceAccessError &&
          ['INVALID_OFFLINE_COPY', 'INTEGRITY_FAILURE'].includes(error.code)
        ) {
          throw error
        }
        throw new ResourceAccessError('NETWORK_OFFLINE', ['retry', 'acquire-offline-copy'])
      }
    }

    const [localPage, remotePage] = await Promise.all([
      local.loadVersePage(verse),
      remote.loadVersePage(verse, undefined, language),
    ])
    return {
      id: verse,
      count: localPage.count + remotePage.count,
      comments: [...localPage.comments, ...remotePage.comments],
    }
  },
})

export const defaultCommentaryAccess = createCommentaryAccess()
