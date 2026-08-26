/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({ firebaseDb: {} }))
jest.mock('~helpers/loadMhyComments', () => jest.fn())
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

import loadMhyComments from '~helpers/loadMhyComments'
import { getLocalResourceAvailability } from '../resourceAvailability'
import {
  CommentaryAccessError,
  createCommentaryAccess,
  defaultCommentaryAccess,
  firestoreCommentaryAccess,
  localMhyCommentaryAccess,
  type CommentaryAccess,
} from '../commentaryAccess'
import { ResourceAccessError } from '../resourceAccessError'

const mockAvailability = getLocalResourceAvailability as jest.MockedFunction<
  typeof getLocalResourceAvailability
>
const mockLoadMhyComments = loadMhyComments as jest.MockedFunction<typeof loadMhyComments>

const comments = (id: string, order = 1) => ({
  id,
  count: 1,
  comments: [
    {
      id,
      verseId: '1-1-1',
      content: id,
      resource: { name: id, code: id, logo: '', author: id },
      order,
      type: 'comment' as const,
      isSDA: false,
    },
  ],
})

describe('commentary access', () => {
  beforeEach(() => jest.clearAllMocks())

  it('keeps the Commentaries feature backed exclusively by Firestore', () => {
    expect(defaultCommentaryAccess).toBe(firestoreCommentaryAccess)
  })

  it('reads an installed Matthew Henry commentary without a network source', async () => {
    mockAvailability.mockResolvedValue({
      status: 'available',
      resource: { kind: 'database', databaseId: 'MHY', language: 'fr' },
    })
    mockLoadMhyComments.mockResolvedValue({ commentaires: '{"1":"Au commencement"}' })

    await expect(localMhyCommentaryAccess.loadVersePage('1-1-1')).resolves.toMatchObject({
      count: 1,
      comments: [{ content: 'Au commencement', resource: { code: 'MHY' } }],
    })
  })

  it('classifies a corrupt Matthew Henry payload as an invalid offline copy', async () => {
    mockAvailability.mockResolvedValue({
      status: 'available',
      resource: { kind: 'database', databaseId: 'MHY', language: 'fr' },
    })
    mockLoadMhyComments.mockResolvedValue({ commentaires: 'not-json' })

    await expect(localMhyCommentaryAccess.loadVersePage('1-1-1')).rejects.toMatchObject({
      code: 'INVALID_OFFLINE_COPY',
    })
  })

  it('combines the local commentary first with remote comments while connected', async () => {
    const local: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const remote: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('REMOTE')) }
    const access = createCommentaryAccess({ isOnline: async () => true, local, remote })

    await expect(access.loadVersePage('1-1-1')).resolves.toMatchObject({
      count: 2,
      comments: [{ id: 'MHY' }, { id: 'REMOTE' }],
    })
  })

  it('does not return a partial commentary page when one connected corpus fails', async () => {
    const local: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const remote: CommentaryAccess = {
      loadVersePage: jest.fn(async () => {
        throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
      }),
    }
    const access = createCommentaryAccess({ isOnline: async () => true, local, remote })

    await expect(access.loadVersePage('1-1-1')).rejects.toMatchObject({
      code: 'TEMPORARY_UNAVAILABLE',
    })
  })

  it('does not merge the French MHY copy into English commentary results', async () => {
    const local: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const remote: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('REMOTE')) }
    const access = createCommentaryAccess({ isOnline: async () => true, local, remote })

    await expect(access.loadVersePage('1-1-1', undefined, 'en')).resolves.toMatchObject({
      count: 1,
      comments: [{ id: 'REMOTE' }],
    })
    expect(local.loadVersePage).not.toHaveBeenCalled()
  })

  it('uses the installed local commentary when disconnected', async () => {
    const local: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const remote: CommentaryAccess = { loadVersePage: jest.fn() }
    const access = createCommentaryAccess({ isOnline: async () => false, local, remote })

    await expect(access.loadVersePage('1-1-1')).resolves.toMatchObject({
      comments: [{ id: 'MHY' }],
    })
    expect(remote.loadVersePage).not.toHaveBeenCalled()
  })

  it('prefers the installed MHY publication without duplicating the same HTTP corpus', async () => {
    const local: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const remote: CommentaryAccess = { loadVersePage: jest.fn(async () => comments('MHY', 0)) }
    const access = createCommentaryAccess({
      isOnline: async () => true,
      local,
      remote,
      combineResults: false,
    })

    await expect(access.loadVersePage('1-1-1')).resolves.toMatchObject({
      count: 1,
      comments: [{ id: 'MHY' }],
    })
    expect(remote.loadVersePage).not.toHaveBeenCalled()
  })

  it('keeps a same-corpus HTTP miss as not-found after the local copy is absent', async () => {
    const local: CommentaryAccess = {
      loadVersePage: jest.fn(async () => {
        throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
      }),
    }
    const remote: CommentaryAccess = {
      loadVersePage: jest.fn(async () => {
        throw new CommentaryAccessError('NOT_FOUND')
      }),
    }
    const access = createCommentaryAccess({
      isOnline: async () => true,
      local,
      remote,
      combineResults: false,
    })

    await expect(access.loadVersePage('1-1-1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('keeps a missing local corpus recoverable when the independent remote corpus has no result', async () => {
    const local: CommentaryAccess = {
      loadVersePage: jest.fn(async () => {
        throw new ResourceAccessError('UNKNOWN', ['acquire-offline-copy'])
      }),
    }
    const remote: CommentaryAccess = {
      loadVersePage: jest.fn(async () => {
        throw new CommentaryAccessError('NOT_FOUND')
      }),
    }
    const access = createCommentaryAccess({ isOnline: async () => true, local, remote })

    await expect(access.loadVersePage('1-1-1')).rejects.toMatchObject({
      recoveries: ['acquire-offline-copy'],
    })
  })

  it('returns genuine not-found only when both installed and remote corpora lack the verse', async () => {
    const unavailable = async () => {
      throw new CommentaryAccessError('NOT_FOUND')
    }
    const access = createCommentaryAccess({
      isOnline: async () => true,
      local: { loadVersePage: unavailable },
      remote: { loadVersePage: unavailable },
    })

    await expect(access.loadVersePage('1-1-1')).rejects.toBeInstanceOf(CommentaryAccessError)
  })

  it('reports offline connectivity instead of temporary failure when no local commentary can answer', async () => {
    const access = createCommentaryAccess({
      isOnline: async () => false,
      local: {
        loadVersePage: async () => {
          throw new CommentaryAccessError('NOT_FOUND')
        },
      },
      remote: { loadVersePage: jest.fn() },
    })

    await expect(access.loadVersePage('1-1-1')).rejects.toMatchObject({
      code: 'NETWORK_OFFLINE',
      recoveries: ['retry', 'acquire-offline-copy'],
    })
  })

  it('reports offline connectivity for non-French remote commentary', async () => {
    const access = createCommentaryAccess({ isOnline: async () => false })

    await expect(access.loadVersePage('1-1-1', undefined, 'en')).rejects.toMatchObject({
      code: 'NETWORK_OFFLINE',
    })
  })
})
