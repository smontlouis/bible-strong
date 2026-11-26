import { pruneAssistantConversations } from '../assistantConversationFirestore'

type Ref = { path: string }

const mockStore = new Map<string, { updatedAt: number }>()
const mockDeleted: string[] = []

jest.mock('../firebase', () => ({
  firebaseDb: {},
  collection: (_db: unknown, ...segments: string[]): Ref => ({ path: segments.join('/') }),
  doc: (_db: unknown, ...segments: string[]): Ref => ({ path: segments.join('/') }),
  orderBy: () => 'orderBy',
  limit: () => 'limit',
  query: (ref: Ref) => ref,
  getDocs: async (ref: Ref) => {
    if (ref.path.endsWith('/turns')) {
      const docs = [`${ref.path}/t1`].map(path => ({ id: 't1', ref: { path } }))
      return { size: docs.length, docs }
    }
    const docs = [...mockStore.entries()]
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([id, data]) => ({ id, data: () => data, ref: { path: `${ref.path}/${id}` } }))
    return { size: docs.length, docs }
  },
  deleteDoc: async (ref: Ref) => {
    mockDeleted.push(ref.path)
  },
  writeBatch: () => {
    const paths: string[] = []
    return {
      delete: (ref: Ref) => paths.push(ref.path),
      commit: async () => {
        mockDeleted.push(...paths)
        paths.forEach(path => {
          const id = path.split('/').at(-1) as string
          if (!path.includes('/turns/')) mockStore.delete(id)
        })
      },
    }
  },
  onSnapshot: jest.fn(),
  runTransaction: jest.fn(),
  setDoc: jest.fn(),
}))

describe('pruneAssistantConversations', () => {
  beforeEach(() => {
    mockStore.clear()
    mockDeleted.length = 0
  })

  it('deletes the oldest conversations beyond the limit, with their turns', async () => {
    for (let index = 1; index <= 52; index++) mockStore.set(`c${index}`, { updatedAt: index })
    expect(await pruneAssistantConversations('u', 50)).toBe(2)
    expect([...mockStore.keys()]).not.toEqual(expect.arrayContaining(['c1', 'c2']))
    expect(mockStore.size).toBe(50)
    expect(mockDeleted).toEqual(
      expect.arrayContaining([
        'users/u/assistantConversations/c1',
        'users/u/assistantConversations/c1/turns/t1',
        'users/u/assistantConversations/c2',
      ])
    )
    expect(mockDeleted.some(path => path.includes('/c52'))).toBe(false)
  })

  it('deletes nothing while the account is within the limit', async () => {
    for (let index = 1; index <= 50; index++) mockStore.set(`c${index}`, { updatedAt: index })
    expect(await pruneAssistantConversations('u', 50)).toBe(0)
    expect(mockDeleted).toEqual([])
  })
})
