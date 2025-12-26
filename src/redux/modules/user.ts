import produce, { Draft } from 'immer'
import { Reducer } from 'redux'
import {
  BookmarksObj,
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
import {
  firebaseDb,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from '~helpers/firebase'
import { getLangIsFr } from '~i18n'
import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'
import bookmarksReducer from './user/bookmarks'
import customColorsReducer from './user/customColors'
import highlightsReducer from './user/highlights'
import linksReducer from './user/links'
import notesReducer from './user/notes'
import settingsReducer from './user/settings'
import studiesReducer from './user/studies'
import tagsReducer from './user/tags'
import versionUpdateReducer from './user/versionUpdate'
import { reduceReducers } from './utils'
const deepmerge = require('@fastify/deepmerge')()

/**
 * Nettoie les données corrompues de Firestore
 * Supprime les objets {_type: 'delete'} qui n'auraient pas dû être stockés
 */
const cleanCorruptedFirestoreData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  // Detect corrupted Firestore sentinel that was serialized
  if (obj._type === 'delete') {
    return undefined
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanCorruptedFirestoreData).filter(v => v !== undefined)
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const cleanedValue = cleanCorruptedFirestoreData(obj[key])
    if (cleanedValue !== undefined) {
      result[key] = cleanedValue
    }
  }
  return result
}

export * from './user/bookmarks'
export * from './user/customColors'
export * from './user/highlights'
export * from './user/links'
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
export const RECEIVE_SUBCOLLECTION_UPDATES = 'user/RECEIVE_SUBCOLLECTION_UPDATES'
export const IMPORT_DATA = 'user/IMPORT_DATA'

export interface Study {
  id: string
  title: string
  created_at: number
  modified_at: number
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

export type HighlightType = 'background' | 'textColor' | 'underline'

export type Highlight = {
  color: string
  tags: TagsObj
  date: number
}

export interface HighlightsObj {
  [x: string]: Highlight
}

export interface CustomColor {
  id: string
  hex: string
  createdAt: number
  name?: string
  type?: HighlightType
}
export interface OpenGraphData {
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
  fetchedAt: number
}

export type LinkType =
  | 'youtube'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'vimeo'
  | 'spotify'
  | 'facebook'
  | 'linkedin'
  | 'github'
  | 'website'

export interface Link {
  id?: string
  url: string
  customTitle?: string
  ogData?: OpenGraphData
  linkType: LinkType
  videoId?: string // Pour YouTube, Vimeo, TikTok
  date: number
  tags?: { [x: string]: Tag }
}

export interface LinksObj {
  [verseKey: string]: Link // Clé: "1-1-1" ou "1-1-1/1-1-2"
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
    bookmarks: BookmarksObj
    highlights: HighlightsObj
    notes: NotesObj
    links: LinksObj
    studies: StudiesObj
    tags: TagsObj
    strongsHebreu: {}
    strongsGrec: {}
    words: {}
    naves: {}
    settings: {
      alignContent: 'left' | 'justify'
      lineHeight: 'normal' | 'small' | 'large'
      fontSizeScale: number
      textDisplay: 'inline' | 'block'
      preferredColorScheme: PreferredColorScheme
      preferredLightTheme: PreferredLightTheme
      preferredDarkTheme: PreferredDarkTheme
      press: 'shortPress' | 'longPress'
      notesDisplay: 'inline' | 'block'
      linksDisplay: 'inline' | 'block'
      commentsDisplay: boolean
      shareVerses: {
        hasVerseNumbers: boolean
        hasInlineVerses: boolean
        hasQuotes: boolean
        hasAppName: boolean
      }
      // Dynamically provided for bible webview in BibleTabScreen
      theme: PreferredLightTheme | PreferredDarkTheme
      // Dynamically provided for bible webview in BibleTabScreen
      fontFamily: string
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
      customHighlightColors: CustomColor[]
      defaultColorNames?: {
        color1?: string
        color2?: string
        color3?: string
        color4?: string
        color5?: string
      }
      defaultColorTypes?: {
        color1?: HighlightType
        color2?: HighlightType
        color3?: HighlightType
        color4?: HighlightType
        color5?: HighlightType
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
    bookmarks: {},
    highlights: {},
    notes: {},
    links: {},
    studies: {},
    tags: {},
    strongsHebreu: {},
    strongsGrec: {},
    words: {},
    naves: {},
    settings: {
      alignContent: 'left',
      lineHeight: 'normal',
      fontSizeScale: 0,
      textDisplay: 'inline',
      preferredColorScheme: 'auto',
      preferredLightTheme: 'default',
      preferredDarkTheme: 'dark',
      press: 'longPress',
      notesDisplay: 'inline',
      linksDisplay: 'inline',
      commentsDisplay: false,
      shareVerses: {
        hasVerseNumbers: true,
        hasInlineVerses: true,
        hasQuotes: true,
        hasAppName: true,
      },
      fontFamily: 'Avenir',
      theme: 'default',
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
      customHighlightColors: [],
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
      const { id, email, displayName, photoURL, provider, bible, subscription } = action.payload
        .remoteUserData as FireStoreUserData

      draft.id = id
      draft.email = email
      draft.displayName = draft.displayName || displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.subscription = subscription

      // Preserve subcollection data (managed separately)
      const currentBookmarks = draft.bible.bookmarks
      const currentHighlights = draft.bible.highlights
      const currentNotes = draft.bible.notes
      const currentLinks = draft.bible.links
      const currentTags = draft.bible.tags
      const currentStrongsHebreu = draft.bible.strongsHebreu
      const currentStrongsGrec = draft.bible.strongsGrec
      const currentWords = draft.bible.words
      const currentNaves = draft.bible.naves
      const currentStudies = draft.bible.studies
      const currentChangelog = draft.bible.changelog

      // Merge bible (only settings and other non-subcollection data)
      // Clean corrupted data before merging (removes {_type: 'delete'} objects)
      const cleanedBible = cleanCorruptedFirestoreData(bible || {})
      draft.bible = deepmerge(getInitialState().bible, cleanedBible)

      // Restore subcollection data
      draft.bible.bookmarks = currentBookmarks
      draft.bible.highlights = currentHighlights
      draft.bible.notes = currentNotes
      draft.bible.links = currentLinks
      draft.bible.tags = currentTags
      draft.bible.strongsHebreu = currentStrongsHebreu
      draft.bible.strongsGrec = currentStrongsGrec
      draft.bible.words = currentWords
      draft.bible.naves = currentNaves
      draft.bible.studies = currentStudies
      draft.bible.changelog = currentChangelog

      break
    }

    case RECEIVE_SUBCOLLECTION_UPDATES: {
      const { collection, data } = action.payload as {
        collection:
          | 'bookmarks'
          | 'highlights'
          | 'notes'
          | 'links'
          | 'tags'
          | 'strongsHebreu'
          | 'strongsGrec'
          | 'words'
          | 'naves'
        data: Record<string, unknown>
        isInitialLoad: boolean
      }

      // Update the specific subcollection
      switch (collection) {
        case 'bookmarks':
          draft.bible.bookmarks = data as BookmarksObj
          break
        case 'highlights':
          draft.bible.highlights = data as HighlightsObj
          break
        case 'notes':
          draft.bible.notes = data as NotesObj
          break
        case 'links':
          draft.bible.links = data as LinksObj
          break
        case 'tags':
          draft.bible.tags = data as TagsObj
          break
        case 'strongsHebreu':
          draft.bible.strongsHebreu = data
          break
        case 'strongsGrec':
          draft.bible.strongsGrec = data
          break
        case 'words':
          draft.bible.words = data
          break
        case 'naves':
          draft.bible.naves = data
          break
      }
      break
    }

    case IMPORT_DATA: {
      const { bible, studies } = action.payload
      const currentChangelog = draft.bible.changelog

      // Merge bible (clean corrupted data before merging)
      const cleanedBible = cleanCorruptedFirestoreData(bible || {})
      draft.bible = deepmerge(getInitialState().bible, cleanedBible)

      // Restore studies and changelog
      draft.bible.studies = studies
      draft.bible.changelog = currentChangelog

      break
    }

    /**
     * 4. Update user profile
     */
    case USER_UPDATE_PROFILE:
    case USER_LOGIN_SUCCESS: {
      const { id, email, displayName, photoURL, provider, emailVerified } =
        action.profile as FireAuthProfile

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
      action.payload.forEach((log: any) => {
        // @ts-ignore
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
      // @ts-ignore
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
    bookmarksReducer,
    notesReducer,
    linksReducer,
    highlightsReducer,
    settingsReducer,
    tagsReducer,
    versionUpdateReducer,
    studiesReducer,
    customColorsReducer
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
export function setFontFamily(payload: any) {
  return {
    type: SET_FONT_FAMILY,
    payload,
  }
}

// CHANGELOG
export function saveAllLogsAsSeen(payload: any) {
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

export function onUserUpdateProfile(profile: any) {
  return {
    type: USER_UPDATE_PROFILE,
    payload: profile,
  }
}

export function receiveLiveUpdates({ remoteUserData }: { remoteUserData: FireStoreUserData }) {
  return {
    type: RECEIVE_LIVE_UPDATES,
    payload: { remoteUserData },
  }
}

export function receiveSubcollectionUpdates({
  collection,
  data,
  isInitialLoad,
}: {
  collection:
    | 'bookmarks'
    | 'highlights'
    | 'notes'
    | 'tags'
    | 'strongsHebreu'
    | 'strongsGrec'
    | 'words'
    | 'naves'
  data: Record<string, unknown>
  isInitialLoad: boolean
}) {
  return {
    type: RECEIVE_SUBCOLLECTION_UPDATES,
    payload: { collection, data, isInitialLoad },
  }
}

// Notifications
export function setNotificationVOD(payload: string) {
  return {
    type: SET_NOTIFICATION_VOD,
    payload,
  }
}

export function setNotificationId(payload: any) {
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
  return async (dispatch: any, getState: any) => {
    dispatch({
      type: GET_CHANGELOG,
    })
    const lastChangelog = getState().user.changelog.lastSeen.toString()
    const changelogQuery = query(
      collection(firebaseDb, 'changelog'),
      where('date', '>', lastChangelog),
      orderBy('date', 'desc'),
      limit(20)
    )

    try {
      const querySnapshot = await getDocs(changelogQuery)

      const changelog: any = []
      querySnapshot.forEach((docSnapshot: any) => {
        changelog.push(docSnapshot.data())
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

export function addChangelog(payload: any) {
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
