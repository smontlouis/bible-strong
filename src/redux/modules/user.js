import produce from 'immer'
import deepmerge from 'deepmerge'
import { reduceReducers } from './utils'

import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'

import { firebaseDb } from '~helpers/firebase'

import highlightsReducer from './user/highlights'
import notesReducer from './user/notes'
import settingsReducer from './user/settings'
import tagsReducer from './user/tags'
import versionUpdateReducer from './user/versionUpdate'
import studiesReducer from './user/studies'

export * from './user/highlights'
export * from './user/notes'
export * from './user/settings'
export * from './user/tags'
export * from './user/versionUpdate'
export * from './user/studies'

export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
export const USER_LOGOUT = 'USER_LOGOUT'

export const SAVE_ALL_LOGS_AS_SEEN = 'user/SAVE_ALL_LOGS_AS_SEEN'

export const SET_HISTORY = 'user/SET_HISTORY'
export const DELETE_HISTORY = 'user/DELETE_HISTORY'
export const UPDATE_USER_DATA = 'user/UPDATE_USER_DATA'

export const SET_LAST_SEEN = 'user/SET_LAST_SEEN'

export const SET_NOTIFICATION_VOD = 'user/SET_NOTIFICATION_VOD'
export const SET_NOTIFICATION_ID = 'user/SET_NOTIFICATION_ID'

export const TOGGLE_COMPARE_VERSION = 'user/TOGGLE_COMPARE_VERSION'

export const GET_CHANGELOG = 'user/GET_CHANGELOG'
export const GET_CHANGELOG_SUCCESS = 'user/GET_CHANGELOG_SUCCESS'
export const GET_CHANGELOG_FAIL = 'user/GET_CHANGELOG_FAIL'

export const SET_FONT_FAMILY = 'user/SET_FONT_FAMILY'

export const SET_FIRST_TIME = 'user/SET_FIRST_TIME'

export const APP_FETCH_DATA = 'user/APP_FETCH_DATA'
export const APP_FETCH_DATA_FAIL = 'user/APP_FETCH_DATA_FAIL'

const initialState = {
  id: '',
  email: '',
  displayName: '',
  photoURL: '',
  provider: '',
  isFirstTime: true,
  lastSeen: 0,
  emailVerified: false,
  isLoading: false,
  notifications: {
    verseOfTheDay: '07:00',
    notificationId: '',
  },
  changelog: {
    isLoading: true,
    lastSeen: 0,
    data: [],
  },
  needsUpdate: {},
  fontFamily: 'Literata Book',
  bible: {
    changelog: {},
    highlights: {},
    notes: {},
    studies: {},
    tags: {},
    history: [],
    settings: {
      alignContent: 'justify',
      fontSizeScale: 0,
      textDisplay: 'inline',
      theme: 'default',
      press: 'shortPress',
      notesDisplay: 'inline',
      commentsDisplay: false,
      colors: {
        default: defaultColors,
        dark: darkColors,
      },
      compare: {
        LSG: true,
      },
    },
  },
}

const overwriteMerge = (destinationArray, sourceArray) => sourceArray

// UserReducer
const userReducer = produce((draft, action) => {
  switch (action.type) {
    case SET_FIRST_TIME: {
      draft.isFirstTime = action.payload
      break
    }
    case APP_FETCH_DATA: {
      draft.isLoading = true
      break
    }
    case APP_FETCH_DATA_FAIL: {
      draft.isLoading = false
      break
    }
    case SET_FONT_FAMILY: {
      draft.fontFamily = action.payload
      break
    }
    case SET_NOTIFICATION_VOD: {
      draft.notifications.verseOfTheDay = action.payload
      break
    }
    case SET_LAST_SEEN: {
      draft.lastSeen = Date.now()
      break
    }
    case USER_UPDATE_PROFILE:
    case USER_LOGIN_SUCCESS: {
      const {
        id,
        email,
        displayName,
        photoURL,
        provider,
        lastSeen,
        emailVerified,
        bible,
      } = action.profile

      const { isLogged, localLastSeen, remoteLastSeen } = action

      draft.id = id
      draft.email = email
      draft.displayName = displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.lastSeen = lastSeen
      draft.emailVerified = emailVerified
      draft.isLoading = false

      if (bible) {
        if (!isLogged) {
          console.log('User was not logged, merge data')
          draft.bible = deepmerge(draft.bible, bible, {
            arrayMerge: overwriteMerge,
          })
        } else if (remoteLastSeen > localLastSeen) {
          // Remote wins
          console.log('Remote wins')
          draft.bible = { ...draft.bible, ...bible }
        } else if (remoteLastSeen < localLastSeen) {
          console.log('Local wins')
          // Local wins - do nothing
        } else {
          console.log('Last seen equals remote last seen, do nothing')
        }

        // Now take care of studies
        if (action.studies && Object.keys(action.studies).length) {
          if (draft.bible.studies) {
            Object.keys(action.studies).forEach(remoteStudyId => {
              if (draft.bible.studies[remoteStudyId]) {
                // We have a conflict here
                console.log(
                  `We have a conflict with ${remoteStudyId}, pick by modified_date`
                )
                const localModificationDate =
                  draft.bible.studies[remoteStudyId].modified_at
                const remoteModificationDate =
                  action.studies[remoteStudyId].modified_at
                if (remoteModificationDate > localModificationDate) {
                  console.log('Remote date is recent')
                  draft.bible.studies[remoteStudyId] =
                    action.studies[remoteStudyId]
                }
              } else {
                // No conflicts, just put that study in there
                console.log(
                  `No conflicts for ${remoteStudyId}, just put that story in there`
                )
                draft.bible.studies[remoteStudyId] =
                  action.studies[remoteStudyId]
              }
            })
          } else {
            draft.bible.studies = {}
            draft.bible.studies = bible.studies
          }
        }
      }
      break
    }
    case USER_LOGOUT: {
      return {
        ...initialState,
        bible: {
          ...initialState.bible,
          // Keep changelog
          changelog: draft.bible.changelog,
        },
      }
    }
    case SAVE_ALL_LOGS_AS_SEEN: {
      action.payload.forEach(log => {
        draft.bible.changelog[log.date] = true
      })
      break
    }
    case DELETE_HISTORY: {
      draft.bible.history = []
      break
    }
    case SET_HISTORY: {
      const item = action.payload
      if (draft.bible.history.length) {
        const prevItem = draft.bible.history[0]
        if (prevItem.type === item.type) {
          if (
            item.type === 'verse' &&
            item.book == prevItem.book &&
            item.chapter == prevItem.chapter &&
            item.version == prevItem.version
          ) {
            return draft
          }

          if (item.type === 'strong' && item.Code == prevItem.Code) {
            return draft
          }

          if (item.type === 'word' && item.word == prevItem.word) {
            return draft
          }
        }
      }

      draft.bible.history.unshift({
        ...action.payload,
        date: Date.now(),
      })
      draft.bible.history = draft.bible.history.slice(0, 50)
      break
    }
    case TOGGLE_COMPARE_VERSION: {
      if (draft.bible.settings.compare[action.payload]) {
        delete draft.bible.settings.compare[action.payload]
      } else {
        draft.bible.settings.compare[action.payload] = true
      }
      break
    }
    case SET_NOTIFICATION_ID: {
      draft.notifications.notificationId = action.payload
      break
    }
    case GET_CHANGELOG_SUCCESS: {
      draft.changelog.isLoading = false
      draft.changelog.lastSeen = Date.now().toString()
      draft.changelog.data = [...draft.changelog.data, ...action.payload]
      break
    }
    case GET_CHANGELOG_FAIL: {
      draft.changelog.isLoading = false
      break
    }
    default: {
      break
    }
  }
})

export default reduceReducers(
  initialState,
  userReducer,
  notesReducer,
  highlightsReducer,
  settingsReducer,
  tagsReducer,
  versionUpdateReducer,
  studiesReducer
)

// First-Time
export function setFirstTime(payload) {
  return {
    type: SET_FIRST_TIME,
    payload,
  }
}

// FONT-FAMILY
export function setFontFamily(payload) {
  return {
    type: SET_FONT_FAMILY,
    payload,
  }
}

// CHANGELOG
export function saveAllLogsAsSeen(payload) {
  return {
    type: SAVE_ALL_LOGS_AS_SEEN,
    payload,
  }
}

// USERS
export function onUserLoginSuccess(profile, remoteLastSeen, studies) {
  return async (dispatch, getState) => {
    const { id, lastSeen } = getState().user

    dispatch({
      type: USER_LOGIN_SUCCESS,
      isLogged: !!id,
      localLastSeen: lastSeen,
      profile,
      remoteLastSeen,
      studies,
    })
  }
}

export function onUserLogout() {
  return {
    type: USER_LOGOUT,
  }
}

export function onUserUpdateProfile(profile) {
  return {
    type: USER_UPDATE_PROFILE,
    payload: profile,
  }
}

// HISTORY
export function setHistory(item) {
  return {
    type: SET_HISTORY,
    payload: item,
  }
}

export function deleteHistory() {
  return {
    type: DELETE_HISTORY,
  }
}

export function updateUserData() {
  return {
    type: UPDATE_USER_DATA,
  }
}

// Notifications
export function setNotificationVOD(payload) {
  return {
    type: SET_NOTIFICATION_VOD,
    payload,
  }
}

export function setNotificationId(payload) {
  return {
    type: SET_NOTIFICATION_ID,
    payload,
  }
}

// Compare
export function toggleCompareVersion(payload) {
  return {
    type: TOGGLE_COMPARE_VERSION,
    payload,
  }
}

// Changelog
export function getChangelog() {
  return async (dispatch, getState) => {
    dispatch({
      type: GET_CHANGELOG,
    })
    const lastChangelog = getState().user.changelog.lastSeen.toString()
    const changelogDoc = firebaseDb
      .collection('changelog')
      .where('date', '>', lastChangelog)
      .orderBy('date', 'desc')
      .limit(20)

    try {
      const querySnapshot = await changelogDoc.get({ source: 'server' })

      const changelog = []
      querySnapshot.forEach(doc => {
        changelog.push(doc.data())
      })

      return dispatch(addChangelog(changelog))
    } catch (e) {
      console.log(e)
      return dispatch({
        type: GET_CHANGELOG_FAIL,
      })
    }
  }
}

export function addChangelog(payload) {
  return {
    type: GET_CHANGELOG_SUCCESS,
    payload,
  }
}
