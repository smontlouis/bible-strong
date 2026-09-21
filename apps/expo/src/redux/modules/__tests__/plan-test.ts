// Mock react-native before other imports
import { getDoc, getDocs } from '~helpers/firebase'
import reducer, {
  cacheImage,
  removePlan,
  resetPlan,
  addPlan,
  markAsRead,
  fetchPlans,
  fetchPlan,
  startPlan,
  setPlanReminder,
} from '../plan'
import { RECEIVE_LIVE_UPDATES, IMPORT_DATA, USER_LOGOUT } from '../user'
import type { Plan, OngoingPlan, OnlinePlan, Section, ReadingSlice } from '~common/types'

jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
}))

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({}))

// Mock bibleVersions and databases to avoid deep import chains
jest.mock('~helpers/bibleVersions', () => ({
  versions: {},
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: {},
  getIfDatabaseNeedsUpdate: jest.fn(),
}))

// Mock modules before importing reducer
jest.mock('~helpers/firebase', () => ({
  firebaseDb: {},
  increment: {},
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}))

jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({
    set: jest.fn(),
  })),
}))

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))

// Mock theme imports
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

const createPlan = (id: string, sections: Section[] = []): Plan => ({
  id,
  title: `Plan ${id}`,
  description: 'Test plan',
  author: { id: 'test-author', displayName: 'Test Author', photoUrl: '' },
  image: 'https://example.com/image.jpg',
  sections,
  lastUpdate: Date.now(),
  type: 'yearly',
  lang: 'fr',
})

const createSection = (id: string, readingSlices: ReadingSlice[] = []): Section => ({
  id,
  title: `Section ${id}`,
  subTitle: 'Subtitle',
  readingSlices,
})

const createReadingSlice = (id: string): ReadingSlice => ({
  id,
  slices: [{ type: 'Verse', id: '1-1-1', verses: 'Gen 1:1' }],
})

const getInitialState = () => ({
  onlineStatus: 'Idle' as const,
  myPlans: [] as Plan[],
  onlinePlans: [] as OnlinePlan[],
  ongoingPlans: [] as OngoingPlan[],
  images: {} as { [key: string]: string },
})

describe('Plan Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('cacheImage', () => {
    it('should cache an image', () => {
      const newState = reducer(initialState, cacheImage({ id: 'plan-1', value: 'base64-data' }))
      expect(newState.images['plan-1']).toBe('base64-data')
    })

    it('should cache multiple images', () => {
      let state = reducer(initialState, cacheImage({ id: 'plan-1', value: 'base64-1' }))
      state = reducer(state, cacheImage({ id: 'plan-2', value: 'base64-2' }))
      expect(state.images['plan-1']).toBe('base64-1')
      expect(state.images['plan-2']).toBe('base64-2')
    })
  })

  describe('removePlan', () => {
    it('should remove plan from myPlans', () => {
      const state = {
        ...initialState,
        myPlans: [createPlan('plan-1'), createPlan('plan-2')],
      }
      const newState = reducer(state, removePlan('plan-1'))
      expect(newState.myPlans).toHaveLength(1)
      expect(newState.myPlans[0].id).toBe('plan-2')
    })

    it('should remove plan from ongoingPlans', () => {
      const state = {
        ...initialState,
        ongoingPlans: [
          { id: 'plan-1', status: 'Progress' as const, readingSlices: {} },
          { id: 'plan-2', status: 'Idle' as const, readingSlices: {} },
        ],
      }
      const newState = reducer(state, removePlan('plan-1'))
      expect(newState.ongoingPlans).toHaveLength(1)
      expect(newState.ongoingPlans[0].id).toBe('plan-2')
    })

    it('should remove from both myPlans and ongoingPlans', () => {
      const state = {
        ...initialState,
        myPlans: [createPlan('plan-1')],
        ongoingPlans: [{ id: 'plan-1', status: 'Progress' as const, readingSlices: {} }],
      }
      const newState = reducer(state, removePlan('plan-1'))
      expect(newState.myPlans).toHaveLength(0)
      expect(newState.ongoingPlans).toHaveLength(0)
    })

    it('should do nothing if plan not found', () => {
      const state = {
        ...initialState,
        myPlans: [createPlan('plan-1')],
      }
      const newState = reducer(state, removePlan('non-existent'))
      expect(newState.myPlans).toHaveLength(1)
    })
  })

  describe('resetPlan', () => {
    it('should remove plan from ongoingPlans only', () => {
      const state = {
        ...initialState,
        myPlans: [createPlan('plan-1')],
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Progress' as const,
            readingSlices: { 'slice-1': 'Completed' as const },
          },
        ],
      }
      const newState = reducer(state, resetPlan('plan-1'))
      expect(newState.myPlans).toHaveLength(1)
      expect(newState.ongoingPlans).toHaveLength(0)
    })

    it('should do nothing if plan not in ongoingPlans', () => {
      const state = {
        ...initialState,
        ongoingPlans: [{ id: 'plan-2', status: 'Idle' as const, readingSlices: {} }],
      }
      const newState = reducer(state, resetPlan('plan-1'))
      expect(newState.ongoingPlans).toHaveLength(1)
    })
  })

  describe('addPlan', () => {
    it('should add plan to myPlans', () => {
      const plan = createPlan('plan-1')
      const newState = reducer(initialState, addPlan(plan))
      expect(newState.myPlans).toHaveLength(1)
      expect(newState.myPlans[0]).toEqual(plan)
    })

    it('should add multiple plans', () => {
      let state = reducer(initialState, addPlan(createPlan('plan-1')))
      state = reducer(state, addPlan(createPlan('plan-2')))
      expect(state.myPlans).toHaveLength(2)
    })
  })

  describe('markAsRead', () => {
    it('requires explicit start before a first reading can be marked', () => {
      const section = createSection('section-1', [
        createReadingSlice('slice-1'),
        createReadingSlice('slice-2'),
      ])
      const plan = createPlan('plan-1', [section])
      const state = {
        ...initialState,
        myPlans: [plan],
      }

      expect(reducer(state, markAsRead({ readingSliceId: 'slice-1', planId: 'plan-1' }))).toEqual(
        state
      )
      const started = reducer(state, startPlan({ planId: 'plan-1', startDate: '2026-09-14' }))
      const newState = reducer(started, markAsRead({ readingSliceId: 'slice-1', planId: 'plan-1' }))

      expect(newState.ongoingPlans).toHaveLength(1)
      expect(newState.ongoingPlans[0].id).toBe('plan-1')
      expect(newState.ongoingPlans[0].readingSlices['slice-1']).toBe('Completed')
      expect(newState.ongoingPlans[0].readingSlices['slice-2']).toBe('Next')
      expect(newState.ongoingPlans[0].status).toBe('Progress')
    })

    it('should toggle reading slice from completed to uncompleted', () => {
      const section = createSection('section-1', [
        createReadingSlice('slice-1'),
        createReadingSlice('slice-2'),
      ])
      const plan = createPlan('plan-1', [section])
      const state = {
        ...initialState,
        myPlans: [plan],
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Progress' as const,
            readingSlices: { 'slice-1': 'Completed' as const, 'slice-2': 'Next' as const },
          },
        ],
      }

      const newState = reducer(state, markAsRead({ readingSliceId: 'slice-1', planId: 'plan-1' }))

      // When uncompleting, the current slice becomes 'Next' and previous 'Next' markers are cleared
      expect(newState.ongoingPlans[0].readingSlices['slice-1']).toBe('Next')
      expect(newState.ongoingPlans[0].readingSlices['slice-2']).toBeUndefined()
    })

    it('does not enroll an old empty download through a mark action', () => {
      const section = createSection('section-1', [createReadingSlice('slice-1')])
      const plan = createPlan('plan-1', [section])
      const state = {
        ...initialState,
        myPlans: [plan],
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Idle' as const,
            readingSlices: {},
          },
        ],
      }

      const newState = reducer(state, markAsRead({ readingSliceId: 'slice-1', planId: 'plan-1' }))
      expect(newState).toEqual(state)
    })

    it('should set plan status to Completed when all slices are done', () => {
      const section = createSection('section-1', [createReadingSlice('slice-1')])
      const plan = createPlan('plan-1', [section])
      const state = {
        ...initialState,
        myPlans: [plan],
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Progress' as const,
            readingSlices: {},
          },
        ],
      }

      const newState = reducer(state, markAsRead({ readingSliceId: 'slice-1', planId: 'plan-1' }))
      expect(newState.ongoingPlans[0].status).toBe('Completed')
    })

    it('preserves other active plans when marking a new plan', () => {
      const section1 = createSection('section-1', [createReadingSlice('slice-1')])
      const section2 = createSection('section-2', [createReadingSlice('slice-2')])
      const plan1 = createPlan('plan-1', [section1])
      const plan2 = createPlan('plan-2', [section2])
      const state = {
        ...initialState,
        myPlans: [plan1, plan2],
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Progress' as const,
            readingSlices: {},
          },
        ],
      }

      const started = reducer(state, startPlan({ planId: 'plan-2', startDate: '2026-09-14' }))
      const newState = reducer(started, markAsRead({ readingSliceId: 'slice-2', planId: 'plan-2' }))

      expect(newState.ongoingPlans.find(p => p.id === 'plan-1')?.status).toBe('Progress')
      expect(newState.ongoingPlans.find(p => p.id === 'plan-2')?.status).toBe('Completed')
    })
  })

  describe('fetchPlans async thunk', () => {
    it('should set onlineStatus to Pending when pending', () => {
      const action = { type: fetchPlans.pending.type }
      const newState = reducer(initialState, action)
      expect(newState.onlineStatus).toBe('Pending')
    })

    it('should set onlineStatus to Rejected when rejected', () => {
      const action = { type: fetchPlans.rejected.type }
      const newState = reducer(initialState, action)
      expect(newState.onlineStatus).toBe('Rejected')
    })

    it('should set onlineStatus to Resolved and update onlinePlans when fulfilled', () => {
      const onlinePlans = [{ id: 'plan-1', title: 'Plan 1', downloads: 100 }] as OnlinePlan[]
      const action = { type: fetchPlans.fulfilled.type, payload: onlinePlans }
      const newState = reducer(initialState, action)
      expect(newState.onlineStatus).toBe('Resolved')
      expect(newState.onlinePlans).toEqual(onlinePlans)
    })
  })

  describe('fetchPlan async thunk', () => {
    it('should add plan to myPlans when fulfilled', () => {
      const plan = createPlan('plan-1', [createSection('section-1')])
      const action = { type: fetchPlan.fulfilled.type, payload: plan }
      const newState = reducer(initialState, action)
      expect(newState.myPlans).toHaveLength(1)
      expect(newState.myPlans[0]).toEqual(plan)
    })

    it('should update existing plan in myPlans when fulfilled', () => {
      const existingPlan = createPlan('plan-1')
      const state = {
        ...initialState,
        myPlans: [existingPlan],
      }
      const updatedPlan = { ...existingPlan, title: 'Updated Title' }
      const action = { type: fetchPlan.fulfilled.type, payload: updatedPlan }
      const newState = reducer(state, action)
      expect(newState.myPlans).toHaveLength(1)
      expect(newState.myPlans[0].title).toBe('Updated Title')
    })

    it('creates a legacy ongoing entry only when explicitly requested', () => {
      const plan = createPlan('plan-1')
      const action = fetchPlan.fulfilled(plan, 'request', { id: plan.id, enroll: true })
      const newState = reducer(initialState, action)
      expect(newState.ongoingPlans).toHaveLength(1)
      expect(newState.ongoingPlans[0]).toEqual({
        id: 'plan-1',
        status: 'Idle',
        readingSlices: {},
      })
    })

    it('should not duplicate ongoingPlan if already exists', () => {
      const state = {
        ...initialState,
        ongoingPlans: [
          {
            id: 'plan-1',
            status: 'Progress' as const,
            readingSlices: { 'slice-1': 'Completed' as const },
          },
        ],
      }
      const plan = createPlan('plan-1')
      const action = { type: fetchPlan.fulfilled.type, payload: plan }
      const newState = reducer(state, action)
      expect(newState.ongoingPlans).toHaveLength(1)
      expect(newState.ongoingPlans[0].status).toBe('Progress')
      expect(newState.ongoingPlans[0].readingSlices['slice-1']).toBe('Completed')
    })
  })

  describe('RECEIVE_LIVE_UPDATES', () => {
    it('should update ongoingPlans from remote data', () => {
      const remoteOngoingPlans = [
        {
          id: 'plan-1',
          status: 'Progress' as const,
          readingSlices: { 'slice-1': 'Completed' as const },
        },
      ]
      const action = {
        type: RECEIVE_LIVE_UPDATES,
        payload: {
          remoteUserData: {
            plan: remoteOngoingPlans,
          },
        },
      }
      const newState = reducer(initialState, action)
      expect(newState.ongoingPlans).toEqual(remoteOngoingPlans)
    })

    it('should not change ongoingPlans if plan is undefined', () => {
      const state = {
        ...initialState,
        ongoingPlans: [{ id: 'plan-1', status: 'Idle' as const, readingSlices: {} }],
      }
      const action = {
        type: RECEIVE_LIVE_UPDATES,
        payload: { remoteUserData: {} },
      }
      const newState = reducer(state, action)
      expect(newState.ongoingPlans).toEqual(state.ongoingPlans)
    })
  })

  describe('IMPORT_DATA', () => {
    it('should import ongoingPlans', () => {
      const importedPlans = [{ id: 'plan-1', status: 'Completed' as const, readingSlices: {} }]
      const action = {
        type: IMPORT_DATA,
        payload: { plan: importedPlans },
      }
      const newState = reducer(initialState, action)
      expect(newState.ongoingPlans).toEqual(importedPlans)
    })

    it('should not change ongoingPlans if plan is undefined', () => {
      const state = {
        ...initialState,
        ongoingPlans: [{ id: 'plan-1', status: 'Idle' as const, readingSlices: {} }],
      }
      const action = {
        type: IMPORT_DATA,
        payload: {},
      }
      const newState = reducer(state, action)
      expect(newState.ongoingPlans).toEqual(state.ongoingPlans)
    })
  })

  describe('USER_LOGOUT', () => {
    it('should reset state to initial values', () => {
      const state = {
        ...initialState,
        myPlans: [createPlan('plan-1')],
        ongoingPlans: [{ id: 'plan-1', status: 'Progress' as const, readingSlices: {} }],
        onlinePlans: [{ id: 'plan-1', title: 'Online Plan', downloads: 100 }] as OnlinePlan[],
      }
      const action = { type: USER_LOGOUT }
      const newState = reducer(state, action)
      expect(newState.myPlans).toEqual([])
      expect(newState.ongoingPlans).toEqual([])
      expect(newState.onlinePlans).toEqual([])
    })
  })
})

describe('scheduled participation', () => {
  const initialState = reducer(undefined, { type: 'test/init' })
  it('acquires a preview without following it', () => {
    const plan = createPlan('plan-1')
    const state = reducer(
      initialState,
      fetchPlan.fulfilled(plan, 'request', { id: plan.id, enroll: false })
    )
    expect(state.myPlans).toEqual([plan])
    expect(state.ongoingPlans).toEqual([])
  })

  it('schedules legacy progress without clearing completed readings', () => {
    const plan = createPlan('plan-1')
    const existing: OngoingPlan = {
      id: plan.id,
      status: 'Progress',
      readingSlices: { old: 'Completed' },
    }
    const state = reducer(
      { ...initialState, myPlans: [plan], ongoingPlans: [existing] },
      startPlan({ planId: plan.id, startDate: '2026-09-14' })
    )
    expect(state.ongoingPlans[0]).toEqual({ ...existing, startDate: '2026-09-14' })
    expect(reducer(state, startPlan({ planId: plan.id, startDate: '2026-02-30' }))).toEqual(state)
  })

  it('does not enroll a meditation into a relative schedule', () => {
    const plan: Plan = { ...createPlan('collection'), type: 'Livre de méditation' }
    const state = { ...initialState, myPlans: [plan] }
    expect(reducer(state, startPlan({ planId: plan.id, startDate: '2026-09-14' }))).toEqual(state)
  })

  it('validates and disables reminder times without changing progress', () => {
    const existing: OngoingPlan = {
      id: 'plan-1',
      status: 'Progress',
      readingSlices: { old: 'Completed' },
    }
    const state = { ...initialState, ongoingPlans: [existing] }
    expect(reducer(state, setPlanReminder({ planId: 'plan-1', time: '25:00' }))).toEqual(state)
    const enabled = reducer(state, setPlanReminder({ planId: 'plan-1', time: '08:30' }))
    expect(enabled.ongoingPlans[0].reminderTime).toBe('08:30')
    expect(reducer(enabled, setPlanReminder({ planId: 'plan-1', time: null }))).toEqual(state)
  })
})

it('rejects an empty Firestore cache instead of storing a meditation collection without content', async () => {
  jest.mocked(getDoc).mockResolvedValue({ data: () => createPlan('book') } as never)
  jest
    .mocked(getDocs)
    .mockResolvedValue({ empty: true, docs: [], metadata: { fromCache: true } } as never)
  const dispatch = jest.fn()
  const result = await fetchPlan({ id: 'book', enroll: false })(dispatch, jest.fn(), undefined)
  expect(fetchPlan.rejected.match(result)).toBe(true)
  expect(result).toMatchObject({ error: { message: 'Reading content is not available offline' } })
})

it('accepts a server-confirmed empty collection', async () => {
  jest.mocked(getDoc).mockResolvedValue({ data: () => createPlan('book') } as never)
  jest
    .mocked(getDocs)
    .mockResolvedValue({ empty: true, docs: [], metadata: { fromCache: false } } as never)
  const result = await fetchPlan({ id: 'book', enroll: false })(jest.fn(), jest.fn(), undefined)
  expect(fetchPlan.fulfilled.match(result)).toBe(true)
})
