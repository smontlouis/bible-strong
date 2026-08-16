/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({ firebaseDb: {} }))
jest.mock('~helpers/loadMhyComments', () => jest.fn())
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

import loadMhyComments from '~helpers/loadMhyComments'
import { getLocalResourceAvailability } from '../resourceAvailability'
import {
  CommentaryAccessError,
  createCommentaryAccess,
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
})
