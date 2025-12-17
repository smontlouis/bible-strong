import produce from 'immer'

import { versions, getIfVersionNeedsUpdate } from '~helpers/bibleVersions'
import { databases, getIfDatabaseNeedsUpdate } from '~helpers/databases'

export const GET_VERSION_UPDATE = 'user/GET_VERSION_UPDATE'
export const GET_VERSION_UPDATE_SUCCESS = 'user/GET_VERSION_UPDATE_SUCCESS'
export const GET_VERSION_UPDATE_FAIL = 'user/GET_VERSION_UPDATE_FAIL'
export const SET_VERSION_UPDATED = 'user/SET_VERSION_UPDATED'

export default produce((draft, action) => {
  switch (action.type) {
    case GET_VERSION_UPDATE_SUCCESS: {
      draft.needsUpdate = { ...draft.needsUpdate, ...action.payload }
      break
    }
    case SET_VERSION_UPDATED: {
      draft.needsUpdate[action.payload] = false
      break
    }
    default:
      break
  }
})

// Bible Version update
export function getVersionUpdate() {
  return async dispatch => {
    dispatch({
      type: GET_VERSION_UPDATE,
    })

    try {
      const versionsNeedUpdate = await Promise.all(
        Object.keys(versions).map(async versionId => {
          const needsUpdate = await getIfVersionNeedsUpdate(versionId)
          return { [versionId]: needsUpdate }
        })
      )

      dispatch({
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: versionsNeedUpdate.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      })
    } catch (e) {
      dispatch({
        type: GET_VERSION_UPDATE_FAIL,
      })
    }
  }
}

export function setVersionUpdated(payload) {
  return {
    type: SET_VERSION_UPDATED,
    payload,
  }
}

export function getDatabaseUpdate() {
  return async dispatch => {
    dispatch({
      type: GET_VERSION_UPDATE,
    })

    try {
      const databasesNeedUpdate = await Promise.all(
        Object.keys(databases).map(async dbId => {
          const needsUpdate = await getIfDatabaseNeedsUpdate(dbId)
          return { [dbId]: needsUpdate }
        })
      )

      dispatch({
        type: GET_VERSION_UPDATE_SUCCESS,
        payload: databasesNeedUpdate.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      })
    } catch (e) {
      dispatch({
        type: GET_VERSION_UPDATE_FAIL,
      })
    }
  }
}
