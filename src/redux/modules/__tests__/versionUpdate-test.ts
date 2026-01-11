/* eslint-env jest */

import versionUpdateReducer, {
  GET_VERSION_UPDATE_SUCCESS,
  SET_VERSION_UPDATED,
} from '../user/versionUpdate'

// Mock external dependencies
jest.mock('~helpers/bibleVersions', () => ({
  versions: { LSG: {}, KJV: {}, OST: {} },
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: { STRONG: {}, NAVE: {} },
  getIfDatabaseNeedsUpdate: jest.fn(),
}))

const getInitialState = () => ({
  needsUpdate: {} as { [key: string]: boolean },
})

describe('Version Update Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('GET_VERSION_UPDATE_SUCCESS', () => {
    it('should set version update status', () => {
      const newState = versionUpdateReducer(initialState, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { LSG: true, KJV: false, OST: true },
      })
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.KJV).toBe(false)
      expect(newState.needsUpdate.OST).toBe(true)
    })

    it('should merge with existing update status', () => {
      const state = {
        needsUpdate: { LSG: true, KJV: false },
      }
      const newState = versionUpdateReducer(state, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { OST: true, NBS: false },
      })
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.KJV).toBe(false)
      expect(newState.needsUpdate.OST).toBe(true)
      expect(newState.needsUpdate.NBS).toBe(false)
    })

    it('should override existing version status', () => {
      const state = {
        needsUpdate: { LSG: true },
      }
      const newState = versionUpdateReducer(state, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { LSG: false },
      })
      expect(newState.needsUpdate.LSG).toBe(false)
    })

    it('should handle database update status', () => {
      const newState = versionUpdateReducer(initialState, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { STRONG: true, NAVE: false },
      })
      expect(newState.needsUpdate.STRONG).toBe(true)
      expect(newState.needsUpdate.NAVE).toBe(false)
    })

    it('should handle mixed version and database update status', () => {
      const newState = versionUpdateReducer(initialState, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { LSG: true, STRONG: false },
      })
      expect(newState.needsUpdate.LSG).toBe(true)
      expect(newState.needsUpdate.STRONG).toBe(false)
    })

    it('should handle empty payload', () => {
      const state = {
        needsUpdate: { LSG: true },
      }
      const newState = versionUpdateReducer(state, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: {},
      })
      expect(newState.needsUpdate.LSG).toBe(true)
    })
  })

  describe('SET_VERSION_UPDATED', () => {
    it('should set version as updated (false)', () => {
      const state = {
        needsUpdate: { LSG: true, KJV: true },
      }
      const newState = versionUpdateReducer(state, {
        type: SET_VERSION_UPDATED,
        payload: 'LSG',
      })
      expect(newState.needsUpdate.LSG).toBe(false)
      expect(newState.needsUpdate.KJV).toBe(true)
    })

    it('should set database as updated (false)', () => {
      const state = {
        needsUpdate: { STRONG: true, NAVE: true },
      }
      const newState = versionUpdateReducer(state, {
        type: SET_VERSION_UPDATED,
        payload: 'STRONG',
      })
      expect(newState.needsUpdate.STRONG).toBe(false)
      expect(newState.needsUpdate.NAVE).toBe(true)
    })

    it('should handle setting non-existent version as updated', () => {
      const newState = versionUpdateReducer(initialState, {
        type: SET_VERSION_UPDATED,
        payload: 'NEW_VERSION',
      })
      expect(newState.needsUpdate.NEW_VERSION).toBe(false)
    })

    it('should not affect other versions', () => {
      const state = {
        needsUpdate: { LSG: true, KJV: true, OST: false },
      }
      const newState = versionUpdateReducer(state, {
        type: SET_VERSION_UPDATED,
        payload: 'LSG',
      })
      expect(newState.needsUpdate.LSG).toBe(false)
      expect(newState.needsUpdate.KJV).toBe(true)
      expect(newState.needsUpdate.OST).toBe(false)
    })
  })

  describe('default case', () => {
    it('should return state unchanged for unknown action', () => {
      const state = {
        needsUpdate: { LSG: true },
      }
      const newState = versionUpdateReducer(state, { type: 'UNKNOWN_ACTION' })
      expect(newState).toEqual(state)
    })
  })

  describe('integration scenarios', () => {
    it('should handle full update check and marking as updated', () => {
      // Simulate initial check showing all need update
      let state = versionUpdateReducer(initialState, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { LSG: true, KJV: true, OST: true },
      })
      expect(state.needsUpdate.LSG).toBe(true)
      expect(state.needsUpdate.KJV).toBe(true)
      expect(state.needsUpdate.OST).toBe(true)

      // User updates LSG
      state = versionUpdateReducer(state, {
        type: SET_VERSION_UPDATED,
        payload: 'LSG',
      })
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(true)
      expect(state.needsUpdate.OST).toBe(true)

      // User updates KJV
      state = versionUpdateReducer(state, {
        type: SET_VERSION_UPDATED,
        payload: 'KJV',
      })
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(false)
      expect(state.needsUpdate.OST).toBe(true)

      // New check shows only OST needs update
      state = versionUpdateReducer(state, {
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: { LSG: false, KJV: false, OST: true },
      })
      expect(state.needsUpdate.LSG).toBe(false)
      expect(state.needsUpdate.KJV).toBe(false)
      expect(state.needsUpdate.OST).toBe(true)
    })
  })
})
