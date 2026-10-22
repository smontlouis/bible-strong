/* eslint-disable @typescript-eslint/no-require-imports */
import type { Plan } from '~common/types'

const mockValues = new Map<string, string>()
const mockSet = jest.fn((key: string, value: string) => {
  mockValues.set(key, value)
})

jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockSet(key, value),
    remove: (key: string) => mockValues.delete(key),
  },
}))

jest.mock('react-native', () => ({
  Appearance: { getColorScheme: jest.fn(() => 'light') },
}))
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))
jest.mock('expo-sqlite', () => ({}))
jest.mock('~helpers/bibleVersions', () => ({ versions: {}, getIfVersionNeedsUpdate: jest.fn() }))
jest.mock('~helpers/databases', () => ({ databases: {}, getIfDatabaseNeedsUpdate: jest.fn() }))
jest.mock('~helpers/firebase', () => ({
  firebaseDb: {},
  increment: {},
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}))
jest.mock('~state/tabs', () => ({ tabGroupsAtom: {} }))
jest.mock('jotai/vanilla', () => ({ getDefaultStore: jest.fn(() => ({ set: jest.fn() })) }))
jest.mock('~i18n', () => ({ getLanguage: jest.fn(() => 'fr') }))
jest.mock('~helpers/languageUtils', () => ({ getDefaultBibleVersion: jest.fn(() => 'LSG') }))
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

type PlanModule = typeof import('../plan')
type LaunchedApp = Awaited<ReturnType<typeof launch>>

const createPlan = (id: string): Plan => ({
  id,
  title: `Plan ${id}`,
  description: 'Test plan',
  author: { id: 'test-author', displayName: 'Test Author', photoUrl: '' },
  image: 'https://example.com/image.jpg',
  sections: [
    {
      id: 'section-1',
      title: 'Section 1',
      subTitle: 'Subtitle',
      readingSlices: [
        { id: 'slice-1', slices: [{ type: 'Verse', id: '1-1-1', verses: 'Gen 1:1' }] },
        { id: 'slice-2', slices: [{ type: 'Verse', id: '1-1-2', verses: 'Gen 1:2' }] },
      ],
    },
  ],
  lastUpdate: 1,
  type: 'yearly',
  lang: 'fr',
})

// Each launch loads its own modules, as the app does: a fresh persistReducer and storage adapter.
const launch = async () => {
  let modules:
    | {
        reducer: typeof import('../reducer').default
        plan: PlanModule
        user: typeof import('../user')
        configureStore: typeof import('@reduxjs/toolkit').configureStore
        persistStore: typeof import('redux-persist').persistStore
      }
    | undefined
  jest.isolateModules(() => {
    modules = {
      reducer: require('../reducer').default,
      plan: require('../plan'),
      user: require('../user'),
      configureStore: require('@reduxjs/toolkit').configureStore,
      persistStore: require('redux-persist').persistStore,
    }
  })
  const { reducer, plan, user, configureStore, persistStore } = modules!
  const store = configureStore({
    reducer,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  })
  let persistor: ReturnType<typeof persistStore> | undefined
  await new Promise<void>(resolve => {
    persistor = persistStore(store, null, resolve)
  })
  await persistor!.flush()
  return { store, persistor: persistor!, plan, user }
}

const storedPlanKeys = () => Array.from(mockValues.keys()).filter(key => key.startsWith('plan'))
const writtenKeys = () => mockSet.mock.calls.map(([key]) => key)

const followPlanAndStart = async ({ store, persistor, plan }: LaunchedApp) => {
  store.dispatch(plan.addPlan(createPlan('plan-1')))
  store.dispatch(plan.startPlan({ planId: 'plan-1', startDate: '2026-10-01' }))
  await persistor.flush()
}

describe('plan slice persistence', () => {
  beforeEach(() => {
    mockValues.clear()
    mockSet.mockClear()
  })

  it('stores each key on its own: ticking a reading writes the progress alone', async () => {
    const app = await launch()
    await followPlanAndStart(app)

    expect(storedPlanKeys().sort()).toEqual([
      'plan:_persist',
      'plan:images',
      'plan:keys',
      'plan:myPlans',
      'plan:ongoingPlans',
    ])

    mockSet.mockClear()
    app.store.dispatch(app.plan.markAsRead({ planId: 'plan-1', readingSliceId: 'slice-1' }))
    await app.persistor.flush()

    expect(writtenKeys()).toEqual(['plan:ongoingPlans'])
    expect(JSON.parse(mockValues.get('plan:ongoingPlans')!)[0].readingSlices).toEqual({
      'slice-1': 'Completed',
      'slice-2': 'Next',
    })
  })

  it('restores the plans and the progress at the next launch without writing the plans again', async () => {
    const first = await launch()
    await followPlanAndStart(first)
    first.store.dispatch(first.plan.markAsRead({ planId: 'plan-1', readingSliceId: 'slice-1' }))
    await first.persistor.flush()
    const expected = first.store.getState().plan
    mockSet.mockClear()

    const second = await launch()

    expect(second.store.getState().plan).toEqual(expected)
    expect(second.store.getState().plan.ongoingPlans[0].readingSlices['slice-1']).toBe('Completed')
    expect(writtenKeys()).toEqual(['plan:_persist'])
  })

  it('moves a slice stored in the former format, keeping the progress', async () => {
    const plans = [createPlan('plan-1')]
    const progress = [
      {
        id: 'plan-1',
        status: 'Progress',
        startDate: '2026-10-01',
        readingSlices: { 'slice-1': 'Completed' },
      },
    ]
    mockValues.set(
      'plan',
      JSON.stringify({
        myPlans: JSON.stringify(plans),
        ongoingPlans: JSON.stringify(progress),
        images: JSON.stringify({}),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      })
    )

    const first = await launch()

    expect(first.store.getState().plan.myPlans).toEqual(plans)
    expect(first.store.getState().plan.ongoingPlans).toEqual(progress)
    expect(mockValues.has('plan')).toBe(false)

    const second = await launch()
    expect(second.store.getState().plan.myPlans).toEqual(plans)
    expect(second.store.getState().plan.ongoingPlans).toEqual(progress)
  })

  it('stores the emptied plans at logout', async () => {
    const app = await launch()
    await followPlanAndStart(app)

    app.store.dispatch({ type: app.user.USER_LOGOUT })
    await app.persistor.flush()

    expect(JSON.parse(mockValues.get('plan:myPlans')!)).toEqual([])
    expect(JSON.parse(mockValues.get('plan:ongoingPlans')!)).toEqual([])
    const next = await launch()
    expect(next.store.getState().plan.myPlans).toEqual([])
  })

  it('removes every plan key when the persisted state is purged', async () => {
    mockValues.set('root', '{}')
    const app = await launch()
    await followPlanAndStart(app)

    app.persistor.pause()
    await app.persistor.purge()

    expect(storedPlanKeys()).toEqual([])
    expect(mockValues.get('root')).toBe('{}')
  })
})
