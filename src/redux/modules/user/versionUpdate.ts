import { createAction, createAsyncThunk } from '@reduxjs/toolkit'
import { versions, getIfVersionNeedsUpdate } from '~helpers/bibleVersions'
import { databases, getIfDatabaseNeedsUpdate } from '~helpers/databases'

// Action type constants for backward compatibility
export const GET_VERSION_UPDATE = 'user/GET_VERSION_UPDATE'
export const GET_VERSION_UPDATE_SUCCESS = 'user/GET_VERSION_UPDATE_SUCCESS'
export const GET_VERSION_UPDATE_FAIL = 'user/GET_VERSION_UPDATE_FAIL'
export const SET_VERSION_UPDATED = 'user/SET_VERSION_UPDATED'

// RTK Action Creators
export const setVersionUpdated = createAction(SET_VERSION_UPDATED, (versionId: string) => ({
  payload: versionId,
}))

// Async thunk for version updates
export const getVersionUpdate = createAsyncThunk(
  'user/getVersionUpdate',
  async (_, { rejectWithValue }) => {
    try {
      const versionsNeedUpdate = await Promise.all(
        Object.keys(versions).map(async versionId => {
          const needsUpdate = await getIfVersionNeedsUpdate(versionId)
          return { [versionId]: needsUpdate }
        })
      )
      return versionsNeedUpdate.reduce((acc, curr) => ({ ...acc, ...curr }), {})
    } catch (e) {
      return rejectWithValue(e)
    }
  }
)

// Async thunk for database updates
export const getDatabaseUpdate = createAsyncThunk(
  'user/getDatabaseUpdate',
  async (_, { rejectWithValue }) => {
    try {
      const databasesNeedUpdate = await Promise.all(
        Object.keys(databases).map(async dbId => {
          const needsUpdate = await getIfDatabaseNeedsUpdate(dbId)
          return { [dbId]: needsUpdate }
        })
      )
      return databasesNeedUpdate.reduce((acc, curr) => ({ ...acc, ...curr }), {})
    } catch (e) {
      return rejectWithValue(e)
    }
  }
)
