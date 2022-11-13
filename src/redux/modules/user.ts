import deepmerge from 'deepmerge'
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
} from '~common/types'
import { detailedDiff } from '~helpers/deep-obj'
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
import { isEmpty } from '../../helpers/deep-obj/utils'
import { conflictStateProxy } from '../../state/app'
import highlightsReducer from './user/highlights'
import notesReducer from './user/notes'
import settingsReducer from './user/settings'
import studiesReducer, {
  createStudy,
  deleteStudy,
  updateStudy,
} from './user/studies'
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

let isFirstSnapshotListener = true

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

export interface FireStoreUserData {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  lastSeen: number
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
    delete draft.lastSeen
    delete draft.bible.changelog
    delete draft.bible.history
    delete draft.quota
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

      const bible = (action.remoteUserData as FireStoreUserData)?.bible
      const subscription = (action.remoteUserData as FireStoreUserData)
        ?.subscription

      const { isLogged, localLastSeen, remoteLastSeen } = action

      draft.id = id
      draft.email = email
      draft.displayName = displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.lastSeen = Date.now()
      draft.emailVerified = emailVerified

      // Update draft subscription only if it exists when remote data is fetched
      if (typeof subscription !== 'undefined') {
        draft.subscription = subscription
      }

      /**
       * 4.a. - NOT LOGGED - User was not logged, merge data
       */
      if (!isLogged) {
        console.log('4.a - Reducer - User was not logged - Merge data')

        if (bible) {
          draft.bible = deepmerge(draft.bible, bible, {
            arrayMerge: overwriteMerge,
          })
          if (action.studies) {
            draft.bible.studies = action.studies
          }
        }

        /**
         *  4.a. - LOGGED - User is logged
         */
      } else if (remoteLastSeen > localLastSeen) {
        // Remote wins
        console.log(
          '4.a. - Reducer - Remote wins - Save bible and studies data'
        )
        if (bible) {
          draft.bible = {
            ...draft.bible,
            ...bible,
          }
          if (action.studies) {
            draft.bible.studies = action.studies
          }
        }
      } else if (remoteLastSeen < localLastSeen) {
        // Local wins - do nothing
        console.log('4.a. - Reducer - Local wins - do nothing')
      } else {
        console.log(
          '4.a. - Reducer - Last seen equals remote last seen, do nothing'
        )
      }

      draft.isLoading = false

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
/**
 * 2. onUserLoginSuccess call
 */
export function onUserLoginSuccess({
  profile,
  remoteLastSeen,
}: {
  profile: FireAuthProfile
  remoteLastSeen: number
}) {
  return async (dispatch: any, getState: any) => {
    const { id, lastSeen } = getState().user

    const userRef = firebaseDb.collection('users').doc(profile.id)

    const studiesRef = firebaseDb
      .collection('studies')
      .where('user.id', '==', profile.id)

    const isLogged = !!id

    console.log('Local last seen:', new Date(lastSeen))
    console.log('Online last seen:', new Date(remoteLastSeen))

    /**
     * 3. Dispatch user success function prepare
     */
    const dispatchUserSuccess = (
      remoteUserData?: FireStoreUserData,
      remoteStudiesData?: {
        [key: string]: Study
      }
    ) => async (overwriteRemoteLastSeen?: boolean) => {
      remoteLastSeen = overwriteRemoteLastSeen ? 0 : remoteLastSeen

      /**
       * 3.a Update firebase user status and profile
       */
      console.log('3.a Update firebase profile')
      userRef.set(profile, {
        merge: true,
      })

      /**
       * 3.b Subscribe for live updates
       */
      let unsuscribeUsers: (() => void) | undefined
      let unsuscribeStudies: (() => void) | undefined

      if (isLogged) {
        unsuscribeUsers = firebaseDb
          .collection('users')
          .doc(profile.id)
          .onSnapshot(doc => {
            const source = doc?.metadata.hasPendingWrites ? 'Local' : 'Server'

            /**
             * Ignore local changes
             */
            if (source === 'Local' || !doc) return

            console.log('await 3.b received live update')
            const userData = doc.data() as FireStoreUserData

            return dispatch({
              type: USER_LOGIN_SUCCESS,
              isLogged: !!id,
              localLastSeen: lastSeen,
              profile,
              remoteUserData: userData,
              remoteLastSeen: Date.now(),
              studies: undefined,
            })
          })

        unsuscribeStudies = firebaseDb
          .collection('studies')
          .where('user.id', '==', profile.id)
          .onSnapshot(querySnapshot => {
            const source = querySnapshot?.metadata.hasPendingWrites
              ? 'Local'
              : 'Server'
            if (source === 'Local' || !querySnapshot) return

            querySnapshot.docChanges().forEach(change => {
              // Ignore first listener adding all documents
              if (isFirstSnapshotListener) return

              if (change.type === 'added') {
                console.log('New study: ', change.doc.data().id)
                dispatch(
                  createStudy({
                    id: change.doc.data().id,
                    content: change.doc.data().content,
                    title: change.doc.data().title,
                    updateRemote: false,
                  })
                )
              }
              if (change.type === 'modified') {
                console.log('Modified study: ', change.doc.data().id)
                dispatch(
                  updateStudy({
                    id: change.doc.data().id,
                    content: change.doc.data().content,
                    title: change.doc.data().title,
                    tags: change.doc.data().tags,
                    updateRemote: false,
                  })
                )
              }
              if (change.type === 'removed') {
                console.log('Removed study: ', change.doc.data().id)
                dispatch(deleteStudy(change.doc.data().id))
              }
            })

            isFirstSnapshotListener = false
          })
      } else {
        unsuscribeUsers?.()
        unsuscribeStudies?.()
      }

      /**
       * 3.c Pass data to USER_LOGIN_SUCCESS reducer
       */
      console.log('3.c Pass data to USER_LOGIN_SUCCESS reducer')
      return dispatch({
        type: USER_LOGIN_SUCCESS,
        isLogged: !!id,
        localLastSeen: lastSeen,
        profile,
        remoteUserData,
        remoteLastSeen,
        studies: remoteStudiesData,
      })
    }

    /**
     * 2.a1 - Handle conflict only when user is logged and data online is newer
     */
    if (remoteLastSeen > lastSeen && id) {
      console.log('2.a1 - remoteLastSeen > lastSeen && id - handle conflict')

      /**
       * 2.a2 - Get local user data in firestore format
       */
      const oldUserData = ignoreOfflineData({
        ...getState().user,
        bible: {
          ...getState().user.bible,
          plan: getState().plan.ongoingPlans,
        },
        plan: undefined,
      })

      // Get remote data - expensive (1mb max)
      console.log('2.a2 - Get remote data - expensive (1mb max)')
      const userDoc = await userRef.get()
      const userData = userDoc.data() as FireStoreUserData

      // Get remote studies
      console.log('2.a2 - Get remote studies')
      const studies = {} as { [key: string]: Study }
      const querySnapshot = await studiesRef.get()
      querySnapshot.forEach(doc => {
        const study = doc.data() as Study
        studies[study.id] = study
      })

      /**
       * 2.a3 - Merge remote data with redux state so we can compare fairly
       */
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

      /**
       * 2.a4 - Compare local and remote data
       * Remove useless data from diff object
       */
      const obj = detailedDiff(oldUserData, newUserData, true)
      delete obj?.updated?.bible?.settings?.theme
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
      // End of conflict handling

      /**
       * 2.a5 - If there is no conflict, dispatch user success with data from firestore
       */
      if (isEmpty(obj?.updated) && isEmpty(obj?.deleted)) {
        console.log(
          '2.a5 - If there is no conflict, dispatch user success with data from firestore'
        )
        dispatchUserSuccess(userData, studies)()
        return
      }

      /**
       * 2.a6 - If there is a conflict, dispatch conflict action
       * Pass the diff object and onDispatchUserSuccess to conflict state proxy in ConflictModal
       */
      console.log(
        '2.a6 - If there is a conflict, dispatch conflict action',
        obj
      )
      conflictStateProxy.diff = obj
      conflictStateProxy.onDispatchUserSuccess = dispatchUserSuccess(
        userData,
        studies
      )
      conflictStateProxy.lastSeen = lastSeen
      conflictStateProxy.remoteLastSeen = remoteLastSeen

      /**
       * 2.b1 - Local data is newer
       */
    } else {
      /**
       * 2.b2 - Not Logged - User is not logged, get remote data
       */
      if (!isLogged) {
        const userDoc = await userRef.get()
        const userData = userDoc.data() as FireStoreUserData

        const studies = {} as { [key: string]: Study }
        const querySnapshot = await studiesRef.get()
        querySnapshot.forEach(doc => {
          const study = doc.data() as Study
          studies[study.id] = study
        })

        /**
         * 2.b1 - Logged - Dispatch user success with data from firestore
         */
        dispatchUserSuccess(userData, studies)()
        return
      }

      /**
       * 2.b2 - Logged - User is logged, dispatch user success with no remote data
       */
      console.log('2.b2 - Logged - User is logged - no conflict')
      dispatchUserSuccess()()
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
