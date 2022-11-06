import deepmerge from 'deepmerge'
import produce, { Draft } from 'immer'
import { Reducer } from 'redux'
import {
  ChangelogItem,
  CurrentTheme,
  PreferredColorScheme,
  PreferredDarkTheme,
  PreferredLightTheme,
  SubscriptionType,
  Tag,
} from '~common/types'
import { detailedDiff } from '~helpers/deep-obj'
import { firebaseDb } from '~helpers/firebase'
import { getLangIsFr } from '~i18n'
import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import sepiaColors from '~themes/sepiaColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import mauveColors from '~themes/mauveColors'
import sunsetColors from '~themes/sunsetColors'
import { isEmpty } from '../../helpers/deep-obj/utils'
import { conflictStateProxy } from '../../state/app'
import highlightsReducer from './user/highlights'
import notesReducer from './user/notes'
import settingsReducer from './user/settings'
import studiesReducer from './user/studies'
import tagsReducer from './user/tags'
import versionUpdateReducer from './user/versionUpdate'
import { reduceReducers } from './utils'

export * from './user/highlights'
export * from './user/notes'
export * from './user/settings'
export * from './user/studies'
export * from './user/tags'
export * from './user/versionUpdate'

export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
export const USER_LOGOUT = 'USER_LOGOUT'

export const SAVE_ALL_LOGS_AS_SEEN = 'user/SAVE_ALL_LOGS_AS_SEEN'

export const SET_HISTORY = 'user/SET_HISTORY'
export const DELETE_HISTORY = 'user/DELETE_HISTORY'

export const SET_LAST_SEEN = 'user/SET_LAST_SEEN'

export const SET_NOTIFICATION_VOD = 'user/SET_NOTIFICATION_VOD'
export const SET_NOTIFICATION_ID = 'user/SET_NOTIFICATION_ID'

export const TOGGLE_COMPARE_VERSION = 'user/TOGGLE_COMPARE_VERSION'
export const RESET_COMPARE_VERSION = 'user/RESET_COMPARE_VERSION'

export const GET_CHANGELOG = 'user/GET_CHANGELOG'
export const GET_CHANGELOG_SUCCESS = 'user/GET_CHANGELOG_SUCCESS'
export const GET_CHANGELOG_FAIL = 'user/GET_CHANGELOG_FAIL'

export const SET_FONT_FAMILY = 'user/SET_FONT_FAMILY'

export const APP_FETCH_DATA = 'user/APP_FETCH_DATA'
export const APP_FETCH_DATA_FAIL = 'user/APP_FETCH_DATA_FAIL'

export const SET_SUBSCRIPTION = 'user/SET_SUBSCRIPTION'
export const EMAIL_VERIFIED = 'user/EMAIL_VERIFIED'
export const UPDATE_QUOTA = 'user/UPDATE_QUOTA'

export const RESET_QUOTA = 'user/RESET_QUOTA'

export interface Study {
  id: string
  title: string
  created_at: number
  content: {
    ops: string[]
  }
  published?: boolean
  user: {
    displayName: string
    id: string
    photoUrl: string
  }
  tags?: { [x: string]: Tag }
}
export interface UserState {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  lastSeen: number
  subscription?: string
  emailVerified: boolean
  isLoading: boolean
  notifications: {
    verseOfTheDay: string
    notificationId: string
  }
  changelog: {
    isLoading: boolean
    lastSeen: number
    data: ChangelogItem[]
  }
  needsUpdate: {
    [x: string]: boolean
  }
  fontFamily: string
  bible: {
    changelog: {}
    highlights: {
      [x: string]: {
        color: string
        tags: {
          [x: string]: Tag
        }
        date: number
      }
    }
    notes: {}
    studies: {
      [x: string]: Study
    }
    tags: {}
    history: any[]
    strongsHebreu: {}
    strongsGrec: {}
    words: {}
    naves: {}
    settings: {
      alignContent: 'left' | 'justify'
      fontSizeScale: number
      textDisplay: 'inline' | 'block'
      preferredColorScheme: PreferredColorScheme
      preferredLightTheme: PreferredLightTheme
      preferredDarkTheme: PreferredDarkTheme
      theme: CurrentTheme
      press: 'shortPress' | 'longPress'
      notesDisplay: 'inline' | 'block'
      commentsDisplay: boolean
      colors: {
        default: typeof defaultColors
        dark: typeof darkColors
        black: typeof blackColors
        sepia: typeof sepiaColors
        nature: typeof natureColors
        sunset: typeof sunsetColors
        mauve: typeof mauveColors
        night: typeof nightColors
      }
      compare: {
        [x: string]: boolean
      }
    }
  }
  quota: {
    bibleSearch: QuotaProps
    timelineSearch: QuotaProps
    translateComments: QuotaProps
  }
}

export type QuotaType = keyof UserState['quota']

export type QuotaProps = {
  remaining: number
  lastDate: number
}

const initialState: UserState = {
  id: '',
  email: '',
  displayName: '',
  photoURL: '',
  provider: '',
  lastSeen: 0,
  subscription: undefined,
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
  fontFamily: 'Avenir',
  bible: {
    changelog: {},
    highlights: {},
    notes: {},
    studies: {},
    tags: {},
    history: [],
    strongsHebreu: {},
    strongsGrec: {},
    words: {},
    naves: {},
    settings: {
      alignContent: 'justify',
      fontSizeScale: 0,
      textDisplay: 'inline',
      preferredColorScheme: 'auto',
      preferredLightTheme: 'default',
      preferredDarkTheme: 'dark',
      theme: 'default',
      press: 'longPress',
      notesDisplay: 'inline',
      commentsDisplay: false,
      colors: {
        default: defaultColors,
        dark: darkColors,
        black: blackColors,
        sepia: sepiaColors,
        nature: natureColors,
        sunset: sunsetColors,
        mauve: mauveColors,
        night: nightColors,
      },
      compare: {
        [getLangIsFr() ? 'LSG' : 'KJV']: true,
      },
    },
  },
  quota: {
    bibleSearch: {
      remaining: 10,
      lastDate: 0,
    },
    timelineSearch: {
      remaining: 10,
      lastDate: 0,
    },
    translateComments: {
      remaining: 10,
      lastDate: 0,
    },
  },
}

const overwriteMerge = (destinationArray, sourceArray) => sourceArray

const ignoreOfflineData = (data: Partial<UserState>) =>
  produce(data, draft => {
    delete draft.notifications
    delete draft.changelog
    delete draft.needsUpdate
    delete draft.fontFamily
    delete draft.isLoading
    delete draft.bible.changelog
  })

// UserReducer
const userReducer = produce((draft: Draft<UserState>, action) => {
  switch (action.type) {
    case EMAIL_VERIFIED: {
      draft.emailVerified = true
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
        subscription,
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
      draft.subscription = subscription

      if (!isLogged) {
        console.log('User was not logged, merge data')

        if (bible) {
          draft.bible = deepmerge(draft.bible, bible, {
            arrayMerge: overwriteMerge,
          })
          draft.bible.studies = action.studies
        }
      } else if (remoteLastSeen > localLastSeen) {
        // Remote wins
        console.log('Remote wins')
        if (bible) {
          draft.bible = {
            ...draft.bible,
            ...bible,
          }
          draft.bible.studies = action.studies
        }
      } else if (remoteLastSeen < localLastSeen) {
        console.log('Local wins')
        // Local wins - do nothing
      } else {
        console.log('Last seen equals remote last seen, do nothing')
      }

      // Take care of migratin
      if (!draft.bible.settings.colors.black) {
        draft.bible.settings.colors.black = blackColors
      }

      if (!draft.bible.settings.colors.sepia) {
        draft.bible.settings.colors.sepia = sepiaColors
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
      if (!Array.isArray(draft.bible.history)) {
        draft.bible.history = Object.values(draft.bible.history)
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
    case RESET_COMPARE_VERSION: {
      draft.bible.settings.compare = {
        [action.payload]: true,
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
    case SET_SUBSCRIPTION: {
      draft.subscription = action.payload
      break
    }

    case UPDATE_QUOTA: {
      const quotaType = action.payload as QuotaType
      draft.quota[quotaType].remaining = draft.quota[quotaType].remaining - 1
      draft.quota[quotaType].lastDate = Date.now()
      break
    }
    case RESET_QUOTA: {
      const now = Date.now()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const todayTimestamp = today.getTime()

      const bibleSearchQuota = draft.quota.bibleSearch
      const timelineSearchQuota = draft.quota.timelineSearch
      const translateCommentsQuota = draft.quota.translateComments

      if (bibleSearchQuota.lastDate < todayTimestamp) {
        draft.quota.bibleSearch = {
          remaining: 10,
          lastDate: todayTimestamp,
        }
      }

      if (timelineSearchQuota.lastDate < todayTimestamp) {
        draft.quota.timelineSearch = {
          remaining: 10,
          lastDate: todayTimestamp,
        }
      }

      if (translateCommentsQuota.lastDate < todayTimestamp) {
        draft.quota.translateComments = {
          remaining: 10,
          lastDate: todayTimestamp,
        }
      }

      break
    }
    default: {
      break
    }
  }
}) as Reducer<UserState>

const reducers = <typeof userReducer>(
  reduceReducers(
    initialState,
    userReducer,
    notesReducer,
    highlightsReducer,
    settingsReducer,
    tagsReducer,
    versionUpdateReducer,
    studiesReducer
  )
)

export default reducers

// Email verified
export function verifyEmail() {
  return {
    type: EMAIL_VERIFIED,
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
export function onUserLoginSuccess({ profile, remoteLastSeen }: any) {
  return async (dispatch: any, getState: any) => {
    const { id, lastSeen } = getState().user
    const userRef = firebaseDb.collection('users').doc(profile.id)
    const studiesRef = firebaseDb
      .collection('studies')
      .where('user.id', '==', profile.id)
    const studies = {}
    let userData = null
    const isLogged = !!id

    console.log('Local last seen:', new Date(lastSeen))
    console.log('Online last seen:', new Date(remoteLastSeen))

    const dispatchUserSuccess = (u, s) => async (
      overwriteRemoteLastSeen?: boolean
    ) => {
      const userStatusRef = firebaseDb
        .collection('users-status')
        .doc(profile.id)
      remoteLastSeen = overwriteRemoteLastSeen ? 0 : remoteLastSeen

      userRef.set(profile, { merge: true })
      userStatusRef.set({ lastSeen: profile.lastSeen }, { merge: true })

      if (remoteLastSeen > lastSeen || !isLogged) {
        profile = { ...profile, ...u }
      }

      return dispatch({
        type: USER_LOGIN_SUCCESS,
        isLogged: !!id,
        localLastSeen: lastSeen,
        profile,
        remoteLastSeen,
        studies: s,
      })
    }

    // Handle conflict only when user is already logged
    if (remoteLastSeen > lastSeen && id) {
      console.log('Handle conflict.')

      const oldUserData = ignoreOfflineData({
        ...getState().user,
        bible: {
          ...getState().user.bible,
          plan: getState().plan.ongoingPlans,
        },
        plan: undefined,
      })

      // Merge online data with redux state so we can compare fairly
      const userDoc = await userRef.get()
      userData = userDoc.data()
      const querySnapshot = await studiesRef.get()
      querySnapshot.forEach(doc => {
        const study = doc.data()
        studies[study.id] = study
      })
      const newUserData = ignoreOfflineData(
        deepmerge(
          initialState,
          {
            ...userData,
            bible: {
              ...userData?.bible,
              studies,
              plan: userData?.plan || [],
            },
            plan: undefined,
          } as any,
          {
            arrayMerge: overwriteMerge,
          }
        )
      )

      const obj = detailedDiff(oldUserData, newUserData, true)
      delete obj?.added?.bible?.history
      delete obj?.updated?.bible?.history
      delete obj?.updated?.bible?.settings?.theme
      delete obj?.deleted?.bible?.history
      delete obj?.updated?.lastSeen
      delete obj?.updated?.emailVerified
      delete obj?.updated?.subscription

      if (isEmpty(obj?.added?.bible)) {
        delete obj?.added?.bible
      }

      if (isEmpty(obj?.updated?.bible?.settings)) {
        delete obj?.updated?.bible?.settings
      }

      if (isEmpty(obj?.updated?.bible)) {
        delete obj?.updated?.bible
      }

      if (isEmpty(obj?.deleted?.bible)) {
        delete obj?.deleted?.bible
      }

      if (isEmpty(obj?.updated) && isEmpty(obj?.deleted)) {
        dispatchUserSuccess(userData, studies)()
        return
      }

      // console.log(obj)
      conflictStateProxy.diff = obj
      conflictStateProxy.onDispatchUserSuccess = dispatchUserSuccess(
        userData,
        studies
      )
      conflictStateProxy.lastSeen = lastSeen
      conflictStateProxy.remoteLastSeen = remoteLastSeen
    } else {
      if (!isLogged) {
        const userDoc = await userRef.get()
        userData = userDoc.data()
        const querySnapshot = await studiesRef.get()
        querySnapshot.forEach(doc => {
          const study = doc.data()
          studies[study.id] = study
        })
      }
      dispatchUserSuccess(userData, studies)()
    }
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

// Notifications
export function setNotificationVOD(payload: string) {
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
export function toggleCompareVersion(payload: string) {
  return {
    type: TOGGLE_COMPARE_VERSION,
    payload,
  }
}

export function resetCompareVersion(payload: 'LSG' | 'KJV') {
  return {
    type: RESET_COMPARE_VERSION,
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

export function setSubscription(payload: SubscriptionType) {
  return {
    type: SET_SUBSCRIPTION,
    payload,
  }
}

// Quota
export function updateQuota(payload: QuotaType) {
  return {
    type: UPDATE_QUOTA,
    payload,
  }
}

export function resetQuotaEveryDay() {
  return {
    type: RESET_QUOTA,
  }
}
