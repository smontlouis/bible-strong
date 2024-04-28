import produce, { Draft } from 'immer'
import { Reducer } from 'redux'
import {
  ChangelogItem,
  OngoingPlan,
  PreferredColorScheme,
  PreferredDarkTheme,
  PreferredLightTheme,
  SubscriptionType,
  Tag,
  TagsObj,
} from '~common/types'
import { FireAuthProfile } from '~helpers/FireAuth'
import { firebaseDb } from '~helpers/firebase'
import { getLangIsFr } from '~i18n'
import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'
import highlightsReducer from './user/highlights'
import notesReducer from './user/notes'
import settingsReducer from './user/settings'
import studiesReducer from './user/studies'
import tagsReducer from './user/tags'
import versionUpdateReducer from './user/versionUpdate'
import { reduceReducers } from './utils'
const deepmerge = require('@fastify/deepmerge')()

export * from './user/highlights'
export * from './user/notes'
export * from './user/settings'
export * from './user/studies'
export * from './user/tags'
export * from './user/versionUpdate'

export const USER_LOGIN_SUCCESS = 'user/USER_LOGIN_SUCCESS'
export const USER_UPDATE_PROFILE = 'user/USER_UPDATE_PROFILE'
export const USER_LOGOUT = 'USER_LOGOUT'

export const SAVE_ALL_LOGS_AS_SEEN = 'user/SAVE_ALL_LOGS_AS_SEEN'

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

export const RECEIVE_LIVE_UPDATES = 'user/RECEIVE_LIVE_UPDATES'
export const IMPORT_DATA = 'user/IMPORT_DATA'

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

export interface StudiesObj {
  [x: string]: Study
}

export interface Note {
  id?: string
  title: string
  description: string
  date: number
  tags?: { [x: string]: Tag }
}

export interface NotesObj {
  [x: string]: Note
}

export type Highlight = {
  color: string
  tags: TagsObj
  date: number
}

export interface HighlightsObj {
  [x: string]: Highlight
}

export interface FireStoreUserData {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  subscription?: string
  bible: UserState['bible']
  plan: OngoingPlan[]
}
export interface UserState {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
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
    highlights: HighlightsObj
    notes: NotesObj
    studies: StudiesObj
    tags: TagsObj
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
      press: 'shortPress' | 'longPress'
      notesDisplay: 'inline' | 'block'
      commentsDisplay: boolean
      shareVerses: {
        hasVerseNumbers: boolean
        hasInlineVerses: boolean
        hasQuotes: boolean
        hasAppName: boolean
      }
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
}

const getInitialState = (): UserState => ({
  id: '',
  email: '',
  displayName: '',
  photoURL: '',
  provider: '',
  subscription: undefined,
  emailVerified: false,
  isLoading: true,
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
      press: 'longPress',
      notesDisplay: 'inline',
      commentsDisplay: false,
      shareVerses: {
        hasVerseNumbers: true,
        hasInlineVerses: true,
        hasQuotes: true,
        hasAppName: true,
      },
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

    case RECEIVE_LIVE_UPDATES: {
      const {
        id,
        email,
        displayName,
        photoURL,
        provider,
        bible,
        subscription,
      } = action.payload.remoteUserData as FireStoreUserData

      draft.id = id
      draft.email = email
      draft.displayName = draft.displayName || displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.subscription = subscription

      // Preserve studies
      const studies = draft.bible.studies

      // Merge bible
      draft.bible = deepmerge(getInitialState().bible, bible || {})

      // Restore studies
      draft.bible.studies = studies

      break
    }

    case IMPORT_DATA: {
      const { bible, studies } = action.payload

      // Merge bible
      draft.bible = deepmerge(getInitialState().bible, bible || {})

      // Restore studies
      draft.bible.studies = studies

      break
    }

    /**
     * 4. Update user profile
     */
    case USER_UPDATE_PROFILE:
    case USER_LOGIN_SUCCESS: {
      const {
        id,
        email,
        displayName,
        photoURL,
        provider,
        emailVerified,
      } = action.profile as FireAuthProfile

      draft.id = id
      draft.email = email
      draft.displayName = draft.displayName || displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.emailVerified = emailVerified
      draft.isLoading = false

      break
    }
    case USER_LOGOUT: {
      return {
        ...getInitialState(),
        bible: {
          ...getInitialState().bible,
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
    default: {
      break
    }
  }
}) as Reducer<UserState>

const reducers = <typeof userReducer>(
  reduceReducers(
    getInitialState(),
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
/**
 * 2. onUserLoginSuccess call
 */
export function onUserLoginSuccess({ profile }: { profile: FireAuthProfile }) {
  return {
    type: USER_LOGIN_SUCCESS,
    profile,
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

export function receiveLiveUpdates({
  remoteUserData,
}: {
  remoteUserData: FireStoreUserData
}) {
  return {
    type: RECEIVE_LIVE_UPDATES,
    payload: { remoteUserData },
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

export function importData(payload: any) {
  return {
    type: IMPORT_DATA,
    payload,
  }
}
