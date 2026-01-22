import { AnyAction, createSlice, PayloadAction, ThunkAction } from '@reduxjs/toolkit'
import { getDefaultStore } from 'jotai/vanilla'
import { Appearance } from 'react-native'

import {
  BookmarksObj,
  ChangelogItem,
  OngoingPlan,
  PreferredColorScheme,
  PreferredDarkTheme,
  PreferredLightTheme,
  Tag,
  TagsObj,
} from '~common/types'
import { FireAuthProfile } from '~helpers/FireAuth'
import { firebaseDb } from '~helpers/firebase'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { getLanguage } from '~i18n'
import { TabGroup, tabGroupsAtom } from '~state/tabs'
import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'
import type { RootState } from '../store'

// Import action creators from sub-modules
import { addBookmarkAction, moveBookmark, removeBookmark, updateBookmark } from './user/bookmarks'
import { addCustomColor, deleteCustomColor, updateCustomColor } from './user/customColors'
import { addHighlightAction, changeHighlightColor, removeHighlight } from './user/highlights'
import { addLinkAction, deleteLink, updateLink } from './user/links'
import { addNoteAction, deleteNote } from './user/notes'
import {
  addWordAnnotationAction,
  changeWordAnnotationColorAction,
  changeWordAnnotationTypeAction,
  removeWordAnnotationAction,
  removeWordAnnotationsInRangeAction,
  updateWordAnnotationAction,
  WordAnnotationsObj,
} from './user/wordAnnotations'
import {
  changeColor,
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setDefaultBibleVersion,
  setDefaultColorName,
  setDefaultColorType,
  setSettingsAlignContent,
  setSettingsCommentaires,
  setSettingsLineHeight,
  setSettingsLinksDisplay,
  setSettingsNotesDisplay,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
  setSettingsPress,
  setSettingsTagsDisplay,
  setSettingsTextDisplay,
  toggleSettingsShareAppName,
  toggleSettingsShareLineBreaks,
  toggleSettingsShareQuotes,
  toggleSettingsShareVerseNumbers,
} from './user/settings'
import { addStudies, deleteStudy, publishStudyAction, updateStudy } from './user/studies'
import { addTag, entitiesArray, removeTag, toggleTagEntity, updateTag } from './user/tags'
import { getDatabaseUpdate, getVersionUpdate, setVersionUpdated } from './user/versionUpdate'

const deepmerge = require('@fastify/deepmerge')()

// Type for color keys (used for dynamic theme color access)
type ColorKeys = keyof typeof defaultColors

// Type for entity tag references (simplified Tag without all properties)
type EntityTagRef = {
  id: string
  name: string
}

// Type for entities that can have tags
type EntityWithTags = {
  tags?: Record<string, EntityTagRef>
  [key: string]: unknown
}

// Type for bible entity collections (used in toggleTagEntity)
type BibleEntityCollection = Record<string, EntityWithTags>

// Re-export everything from sub-modules for backward compatibility
export * from './user/bookmarks'
export * from './user/customColors'
export * from './user/highlights'
export * from './user/links'
export * from './user/notes'
export * from './user/settings'
export * from './user/studies'
export * from './user/tags'
export * from './user/versionUpdate'
export * from './user/wordAnnotations'

// Re-export types
export type { Tag }

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

// Helper function to remove entity from tags
const removeEntityInTags = (
  draft: UserState,
  entity: 'notes' | 'links' | 'highlights' | 'studies' | 'wordAnnotations',
  key: string
) => {
  for (const tag in draft.bible.tags) {
    if (draft.bible.tags[tag][entity]) {
      delete draft.bible.tags[tag][entity][key]
    }
  }
}

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
  tags?: TagsObj
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

export interface ImportDataPayload {
  bible: Partial<UserState['bible']>
  studies: StudiesObj
  tabGroups?: TabGroup[]
}

export interface UserState {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  subscription?: string
  emailVerified: boolean
  createdAt: string | null
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
    changelog: Record<string, boolean>
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
    wordAnnotations: WordAnnotationsObj
    settings: {
      defaultBibleVersion?: string
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
      tagsDisplay: 'inline' | 'block'
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
  createdAt: null,
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
    wordAnnotations: {},
    settings: {
      defaultBibleVersion: getDefaultBibleVersion(getLanguage()),
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
      tagsDisplay: 'inline',
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
        [getDefaultBibleVersion(getLanguage())]: true,
      },
      customHighlightColors: [],
    },
  },
})

const MAX_CUSTOM_COLORS = 5

const userSlice = createSlice({
  name: 'user',
  initialState: getInitialState(),
  reducers: {
    verifyEmail(state) {
      state.emailVerified = true
    },
    setFontFamily(state, action: PayloadAction<string>) {
      state.fontFamily = action.payload
    },
    saveAllLogsAsSeen(state, action: PayloadAction<ChangelogItem[]>) {
      action.payload.forEach(log => {
        state.bible.changelog[log.date] = true
      })
    },
    onUserLoginSuccess(state, action: PayloadAction<{ profile: FireAuthProfile }>) {
      const { id, email, displayName, photoURL, provider, emailVerified } = action.payload.profile

      state.id = id
      state.email = email
      state.displayName = state.displayName || displayName
      state.photoURL = photoURL
      state.provider = provider
      state.emailVerified = emailVerified
      state.createdAt = action.payload.profile.createdAt || null
      state.isLoading = false
    },
    onUserLogout(state) {
      const initialState = getInitialState()
      return {
        ...initialState,
        bible: {
          ...initialState.bible,
          // Keep changelog
          changelog: state.bible.changelog,
        },
      }
    },
    onUserUpdateProfile(
      state,
      action: PayloadAction<
        Partial<{ displayName: string; photoURL: string; emailVerified: boolean }>
      >
    ) {
      const profile = action.payload
      if (profile) {
        if (profile.displayName !== undefined) state.displayName = profile.displayName
        if (profile.photoURL !== undefined) state.photoURL = profile.photoURL
        if (profile.emailVerified !== undefined) state.emailVerified = profile.emailVerified
      }
    },
    receiveLiveUpdates(state, action: PayloadAction<{ remoteUserData: FireStoreUserData }>) {
      const { id, email, displayName, photoURL, provider, bible, subscription } =
        action.payload.remoteUserData

      state.id = id
      state.email = email
      state.displayName = state.displayName || displayName
      state.photoURL = photoURL
      state.provider = provider
      state.subscription = subscription

      // Preserve subcollection data (managed separately)
      const currentBookmarks = state.bible.bookmarks
      const currentHighlights = state.bible.highlights
      const currentNotes = state.bible.notes
      const currentLinks = state.bible.links
      const currentTags = state.bible.tags
      const currentStrongsHebreu = state.bible.strongsHebreu
      const currentStrongsGrec = state.bible.strongsGrec
      const currentWords = state.bible.words
      const currentNaves = state.bible.naves
      const currentStudies = state.bible.studies
      const currentChangelog = state.bible.changelog
      const currentWordAnnotations = state.bible.wordAnnotations

      // Merge bible (only settings and other non-subcollection data)
      // Clean corrupted data before merging (removes {_type: 'delete'} objects)
      const cleanedBible = cleanCorruptedFirestoreData(bible || {})
      state.bible = deepmerge(getInitialState().bible, cleanedBible)

      // Restore subcollection data
      state.bible.bookmarks = currentBookmarks
      state.bible.highlights = currentHighlights
      state.bible.notes = currentNotes
      state.bible.links = currentLinks
      state.bible.tags = currentTags
      state.bible.strongsHebreu = currentStrongsHebreu
      state.bible.strongsGrec = currentStrongsGrec
      state.bible.words = currentWords
      state.bible.naves = currentNaves
      state.bible.studies = currentStudies
      state.bible.changelog = currentChangelog
      state.bible.wordAnnotations = currentWordAnnotations
    },
    receiveSubcollectionUpdates(
      state,
      action: PayloadAction<{
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
          | 'wordAnnotations'
        data: Record<string, unknown>
        isInitialLoad: boolean
      }>
    ) {
      const { collection, data } = action.payload

      // Update the specific subcollection
      switch (collection) {
        case 'bookmarks':
          state.bible.bookmarks = data as BookmarksObj
          break
        case 'highlights':
          state.bible.highlights = data as HighlightsObj
          break
        case 'notes':
          state.bible.notes = data as NotesObj
          break
        case 'links':
          state.bible.links = data as LinksObj
          break
        case 'tags':
          state.bible.tags = data as TagsObj
          break
        case 'strongsHebreu':
          state.bible.strongsHebreu = data
          break
        case 'strongsGrec':
          state.bible.strongsGrec = data
          break
        case 'words':
          state.bible.words = data
          break
        case 'naves':
          state.bible.naves = data
          break
        case 'wordAnnotations':
          state.bible.wordAnnotations = data as WordAnnotationsObj
          break
      }
    },
    importData(state, action: PayloadAction<ImportDataPayload>) {
      const { bible, studies, tabGroups } = action.payload
      const currentChangelog = state.bible.changelog

      // Merge bible (clean corrupted data before merging)
      const cleanedBible = cleanCorruptedFirestoreData(bible || {})
      state.bible = deepmerge(getInitialState().bible, cleanedBible)

      // Restore studies and changelog
      state.bible.studies = studies
      state.bible.changelog = currentChangelog

      // Restaurer les onglets via Jotai
      // Le groupe actif sera automatiquement reset sur groups[0] via activeGroupAtom
      if (tabGroups && tabGroups.length > 0) {
        const store = getDefaultStore()
        store.set(tabGroupsAtom, tabGroups)
      }
    },
    setNotificationVOD(state, action: PayloadAction<string>) {
      state.notifications.verseOfTheDay = action.payload
    },
    setNotificationId(state, action: PayloadAction<string>) {
      state.notifications.notificationId = action.payload
    },
    toggleCompareVersion(state, action: PayloadAction<string>) {
      if (state.bible.settings.compare[action.payload]) {
        delete state.bible.settings.compare[action.payload]
      } else {
        state.bible.settings.compare[action.payload] = true
      }
    },
    resetCompareVersion(state, action: PayloadAction<'LSG' | 'KJV'>) {
      state.bible.settings.compare = {
        [action.payload]: true,
      }
    },
    addChangelog(state, action: PayloadAction<ChangelogItem[]>) {
      state.changelog.isLoading = false
      state.changelog.lastSeen = Date.now()
      state.changelog.data = [...state.changelog.data, ...action.payload]
    },
    getChangelogFail(state) {
      state.changelog.isLoading = false
    },
    appFetchData(state) {
      state.isLoading = true
    },
    appFetchDataFail(state) {
      state.isLoading = false
    },
  },
  extraReducers: builder => {
    // Bookmarks
    builder.addCase(addBookmarkAction, (state, action) => {
      state.bible.bookmarks[action.payload.id] = action.payload
    })
    builder.addCase(removeBookmark, (state, action) => {
      delete state.bible.bookmarks[action.payload]
    })
    builder.addCase(updateBookmark, (state, action) => {
      const { id, ...updates } = action.payload
      if (state.bible.bookmarks[id]) {
        state.bible.bookmarks[id] = {
          ...state.bible.bookmarks[id],
          ...updates,
        }
      }
    })
    builder.addCase(moveBookmark, (state, action) => {
      const { id, book, chapter, verse, version } = action.payload
      if (state.bible.bookmarks[id]) {
        state.bible.bookmarks[id].book = book
        state.bible.bookmarks[id].chapter = chapter
        state.bible.bookmarks[id].verse = verse
        if (version !== undefined) {
          state.bible.bookmarks[id].version = version
        }
        state.bible.bookmarks[id].date = Date.now()
      }
    })

    // Custom Colors
    builder.addCase(addCustomColor, (state, action) => {
      if (state.bible.settings.customHighlightColors.length < MAX_CUSTOM_COLORS) {
        state.bible.settings.customHighlightColors.push(action.payload)
      }
    })
    builder.addCase(updateCustomColor, (state, action) => {
      const { id, hex, name, type } = action.payload
      const colorIndex = state.bible.settings.customHighlightColors.findIndex(
        (c: CustomColor) => c.id === id
      )
      if (colorIndex !== -1) {
        state.bible.settings.customHighlightColors[colorIndex].hex = hex
        state.bible.settings.customHighlightColors[colorIndex].name = name
        state.bible.settings.customHighlightColors[colorIndex].type = type
      }
    })
    builder.addCase(deleteCustomColor, (state, action) => {
      const id = action.payload
      state.bible.settings.customHighlightColors =
        state.bible.settings.customHighlightColors.filter((c: CustomColor) => c.id !== id)
    })

    // Highlights
    builder.addCase(addHighlightAction, (state, action) => {
      state.bible.highlights = {
        ...state.bible.highlights,
        ...action.payload.selectedVerses,
      }
    })
    builder.addCase(removeHighlight, (state, action) => {
      Object.keys(action.payload.selectedVerses).forEach(key => {
        delete state.bible.highlights[key]
        removeEntityInTags(state, 'highlights', key)
      })
    })
    builder.addCase(changeHighlightColor, (state, action) => {
      Object.keys(action.payload.verseIds).forEach(key => {
        state.bible.highlights[key].color = action.payload.color
      })
    })

    // Word Annotations
    builder.addCase(addWordAnnotationAction, (state, action) => {
      const annotation = action.payload.annotation

      // Helper to compare verse keys (e.g., "1-1-5" vs "1-1-10")
      const parseVerseKey = (key: string) => {
        const [book, chapter, verse] = key.split('-').map(Number)
        return { book, chapter, verse }
      }

      const compareVerseKeys = (a: string, b: string): number => {
        const pa = parseVerseKey(a)
        const pb = parseVerseKey(b)
        if (pa.book !== pb.book) return pa.book - pb.book
        if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter
        return pa.verse - pb.verse
      }

      // Get the bounds of the new annotation
      const newRanges = annotation.ranges
      if (newRanges.length > 0) {
        const firstRange = newRanges[0]
        const lastRange = newRanges[newRanges.length - 1]
        const start = { verseKey: firstRange.verseKey, wordIndex: firstRange.startWordIndex }
        const end = { verseKey: lastRange.verseKey, wordIndex: lastRange.endWordIndex }

        // Find and remove overlapping annotations
        const annotationIds = Object.keys(state.bible.wordAnnotations)
        annotationIds.forEach(id => {
          const existingAnnotation = state.bible.wordAnnotations[id]
          if (existingAnnotation.version !== annotation.version) return

          const overlaps = existingAnnotation.ranges.some(range => {
            const rangeVerseCompareStart = compareVerseKeys(range.verseKey, start.verseKey)
            const rangeVerseCompareEnd = compareVerseKeys(range.verseKey, end.verseKey)

            // Check if this range's verse is within the selection verses
            if (rangeVerseCompareStart < 0 || rangeVerseCompareEnd > 0) {
              return false
            }

            // Same verse as both start and end
            if (rangeVerseCompareStart === 0 && rangeVerseCompareEnd === 0) {
              return range.endWordIndex >= start.wordIndex && range.startWordIndex <= end.wordIndex
            }

            // Verse is same as start verse only
            if (rangeVerseCompareStart === 0) {
              return range.endWordIndex >= start.wordIndex
            }

            // Verse is same as end verse only
            if (rangeVerseCompareEnd === 0) {
              return range.startWordIndex <= end.wordIndex
            }

            // Verse is strictly between start and end
            return true
          })

          if (overlaps) {
            delete state.bible.wordAnnotations[id]
            removeEntityInTags(state, 'wordAnnotations', id)
          }
        })
      }

      // Add the new annotation
      state.bible.wordAnnotations[annotation.id] = annotation
    })
    builder.addCase(updateWordAnnotationAction, (state, action) => {
      const { id, changes } = action.payload
      if (state.bible.wordAnnotations[id]) {
        state.bible.wordAnnotations[id] = {
          ...state.bible.wordAnnotations[id],
          ...changes,
        }
      }
    })
    builder.addCase(removeWordAnnotationAction, (state, action) => {
      const id = action.payload.id
      const annotation = state.bible.wordAnnotations[id]

      // Cascade delete: remove associated note if it exists
      if (annotation?.noteId && state.bible.notes[annotation.noteId]) {
        delete state.bible.notes[annotation.noteId]
        removeEntityInTags(state, 'notes', annotation.noteId)
      }

      delete state.bible.wordAnnotations[id]
      removeEntityInTags(state, 'wordAnnotations', id)
    })
    builder.addCase(changeWordAnnotationColorAction, (state, action) => {
      const { id, color } = action.payload
      if (state.bible.wordAnnotations[id]) {
        state.bible.wordAnnotations[id].color = color
      }
    })
    builder.addCase(changeWordAnnotationTypeAction, (state, action) => {
      const { id, type } = action.payload
      if (state.bible.wordAnnotations[id]) {
        state.bible.wordAnnotations[id].type = type
      }
    })
    builder.addCase(removeWordAnnotationsInRangeAction, (state, action) => {
      const { version, start, end } = action.payload

      // Helper to compare verse keys (e.g., "1-1-5" vs "1-1-10")
      const parseVerseKey = (key: string) => {
        const [book, chapter, verse] = key.split('-').map(Number)
        return { book, chapter, verse }
      }

      const compareVerseKeys = (a: string, b: string): number => {
        const pa = parseVerseKey(a)
        const pb = parseVerseKey(b)
        if (pa.book !== pb.book) return pa.book - pb.book
        if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter
        return pa.verse - pb.verse
      }

      // Normalize start and end (ensure start <= end)
      let normalizedStart = start
      let normalizedEnd = end
      const verseCompare = compareVerseKeys(start.verseKey, end.verseKey)
      if (verseCompare > 0 || (verseCompare === 0 && start.wordIndex > end.wordIndex)) {
        normalizedStart = end
        normalizedEnd = start
      }

      // Find all annotations that overlap with the selection range
      const annotationIds = Object.keys(state.bible.wordAnnotations)
      const idsToRemove: string[] = []

      annotationIds.forEach(id => {
        const annotation = state.bible.wordAnnotations[id]
        if (annotation.version !== version) return

        // Check if any range of this annotation overlaps with the selection
        const overlaps = annotation.ranges.some(range => {
          const rangeVerseCompare = compareVerseKeys(range.verseKey, normalizedStart.verseKey)
          const rangeVerseCompareEnd = compareVerseKeys(range.verseKey, normalizedEnd.verseKey)

          // Check if this range's verse is within the selection verses
          if (rangeVerseCompare < 0 || rangeVerseCompareEnd > 0) {
            return false // Verse is outside selection
          }

          // Same verse as start
          if (rangeVerseCompare === 0 && rangeVerseCompareEnd === 0) {
            // Single verse selection - check word indices
            return (
              range.endWordIndex >= normalizedStart.wordIndex &&
              range.startWordIndex <= normalizedEnd.wordIndex
            )
          }

          // Verse is same as start verse only
          if (rangeVerseCompare === 0) {
            return range.endWordIndex >= normalizedStart.wordIndex
          }

          // Verse is same as end verse only
          if (rangeVerseCompareEnd === 0) {
            return range.startWordIndex <= normalizedEnd.wordIndex
          }

          // Verse is strictly between start and end
          return true
        })

        if (overlaps) {
          idsToRemove.push(id)
        }
      })

      // Remove the overlapping annotations
      idsToRemove.forEach(id => {
        delete state.bible.wordAnnotations[id]
        removeEntityInTags(state, 'wordAnnotations', id)
      })
    })

    // Links
    builder.addCase(addLinkAction, (state, action) => {
      state.bible.links = {
        ...state.bible.links,
        ...action.payload,
      }
    })
    builder.addCase(updateLink, (state, action) => {
      const { key, data } = action.payload
      if (state.bible.links[key]) {
        state.bible.links[key] = {
          ...state.bible.links[key],
          ...data,
        }
      }
    })
    builder.addCase(deleteLink, (state, action) => {
      delete state.bible.links[action.payload]
      removeEntityInTags(state, 'links', action.payload)
    })

    // Notes
    builder.addCase(addNoteAction, (state, action) => {
      state.bible.notes = {
        ...state.bible.notes,
        ...action.payload,
      }
    })
    builder.addCase(deleteNote, (state, action) => {
      delete state.bible.notes[action.payload]
      removeEntityInTags(state, 'notes', action.payload)
    })

    // Settings
    builder.addCase(setSettingsAlignContent, (state, action) => {
      state.bible.settings.alignContent = action.payload as 'left' | 'justify'
    })
    builder.addCase(setSettingsLineHeight, (state, action) => {
      state.bible.settings.lineHeight = action.payload
    })
    builder.addCase(setSettingsTextDisplay, (state, action) => {
      state.bible.settings.textDisplay = action.payload as 'inline' | 'block'
    })
    builder.addCase(setSettingsPreferredColorScheme, (state, action) => {
      state.bible.settings.preferredColorScheme = action.payload
    })
    builder.addCase(setSettingsPreferredLightTheme, (state, action) => {
      state.bible.settings.preferredLightTheme = action.payload
    })
    builder.addCase(setSettingsPreferredDarkTheme, (state, action) => {
      state.bible.settings.preferredDarkTheme = action.payload
    })
    builder.addCase(setSettingsNotesDisplay, (state, action) => {
      state.bible.settings.notesDisplay = action.payload as 'inline' | 'block'
    })
    builder.addCase(setSettingsLinksDisplay, (state, action) => {
      state.bible.settings.linksDisplay = action.payload
    })
    builder.addCase(setSettingsTagsDisplay, (state, action) => {
      state.bible.settings.tagsDisplay = action.payload
    })
    builder.addCase(setSettingsCommentaires, (state, action) => {
      state.bible.settings.commentsDisplay = action.payload
    })
    builder.addCase(increaseSettingsFontSizeScale, state => {
      if (state.bible.settings.fontSizeScale < 5) {
        state.bible.settings.fontSizeScale += 1
      }
    })
    builder.addCase(decreaseSettingsFontSizeScale, state => {
      if (state.bible.settings.fontSizeScale > -5) {
        state.bible.settings.fontSizeScale -= 1
      }
    })
    builder.addCase(setSettingsPress, (state, action) => {
      state.bible.settings.press = action.payload as 'shortPress' | 'longPress'
    })
    builder.addCase(changeColor, (state, action) => {
      const preferredColorScheme = state.bible.settings.preferredColorScheme
      const preferredDarkTheme = state.bible.settings.preferredDarkTheme
      const preferredLightTheme = state.bible.settings.preferredLightTheme
      const systemColorScheme = Appearance.getColorScheme()

      // Provide derived theme
      const currentTheme = (() => {
        if (preferredColorScheme === 'auto') {
          if (systemColorScheme === 'dark') {
            return preferredDarkTheme
          }
          return preferredLightTheme
        }

        if (preferredColorScheme === 'dark') return preferredDarkTheme
        return preferredLightTheme
      })()

      type ThemeKey = keyof typeof state.bible.settings.colors
      const colorName = action.payload.name as ColorKeys
      const themeColors = state.bible.settings.colors[currentTheme as ThemeKey]

      const getColorValue = (): string => {
        if (action.payload.color) {
          return action.payload.color as string
        }
        const themeColorMaps: Record<string, typeof defaultColors> = {
          black: blackColors,
          mauve: mauveColors,
          nature: natureColors,
          night: nightColors,
          sepia: sepiaColors,
          sunset: sunsetColors,
          dark: darkColors,
          default: defaultColors,
        }
        return themeColorMaps[currentTheme]?.[colorName] ?? defaultColors[colorName]
      }

      themeColors[colorName] = getColorValue()
    })
    builder.addCase(toggleSettingsShareVerseNumbers, state => {
      state.bible.settings.shareVerses.hasVerseNumbers =
        !state.bible.settings.shareVerses.hasVerseNumbers
    })
    builder.addCase(toggleSettingsShareLineBreaks, state => {
      state.bible.settings.shareVerses.hasInlineVerses =
        !state.bible.settings.shareVerses.hasInlineVerses
    })
    builder.addCase(toggleSettingsShareQuotes, state => {
      state.bible.settings.shareVerses.hasQuotes = !state.bible.settings.shareVerses.hasQuotes
    })
    builder.addCase(toggleSettingsShareAppName, state => {
      state.bible.settings.shareVerses.hasAppName = !state.bible.settings.shareVerses.hasAppName
    })
    builder.addCase(setDefaultColorName, (state, action) => {
      const { colorKey, name } = action.payload
      if (name) {
        // Créer l'objet seulement si on a une valeur à y mettre
        if (!state.bible.settings.defaultColorNames) {
          state.bible.settings.defaultColorNames = {}
        }
        state.bible.settings.defaultColorNames[
          colorKey as keyof typeof state.bible.settings.defaultColorNames
        ] = name
      } else if (state.bible.settings.defaultColorNames) {
        // Supprimer la clé seulement si l'objet existe
        delete state.bible.settings.defaultColorNames[
          colorKey as keyof typeof state.bible.settings.defaultColorNames
        ]
        // Supprimer l'objet entier s'il devient vide
        if (Object.keys(state.bible.settings.defaultColorNames).length === 0) {
          delete state.bible.settings.defaultColorNames
        }
      }
    })
    builder.addCase(setDefaultColorType, (state, action) => {
      const { colorKey, type } = action.payload
      if (type && type !== 'background') {
        // Créer l'objet seulement si on a une valeur à y mettre
        if (!state.bible.settings.defaultColorTypes) {
          state.bible.settings.defaultColorTypes = {}
        }
        state.bible.settings.defaultColorTypes[
          colorKey as keyof typeof state.bible.settings.defaultColorTypes
        ] = type
      } else if (state.bible.settings.defaultColorTypes) {
        // Supprimer la clé seulement si l'objet existe
        delete state.bible.settings.defaultColorTypes[
          colorKey as keyof typeof state.bible.settings.defaultColorTypes
        ]
        // Supprimer l'objet entier s'il devient vide
        if (Object.keys(state.bible.settings.defaultColorTypes).length === 0) {
          delete state.bible.settings.defaultColorTypes
        }
      }
    })
    builder.addCase(setDefaultBibleVersion, (state, action) => {
      state.bible.settings.defaultBibleVersion = action.payload
    })

    // Studies
    builder.addCase(updateStudy, (state, action) => {
      const { id, content, title, modified_at, created_at, tags } = action.payload

      state.bible.studies[id] = {
        ...state.bible.studies[id],
        ...(created_at && { created_at }),
        ...(modified_at && { modified_at }),
        ...(title && { title }),
        ...(content && { content }),
        ...(tags && { tags }),
        user: {
          id: state.id,
          displayName: state.displayName,
          photoUrl: state.photoURL,
        },
        id,
      }
    })
    builder.addCase(addStudies, (state, action) => {
      state.bible.studies = action.payload
    })
    builder.addCase(deleteStudy, (state, action) => {
      delete state.bible.studies[action.payload]
      removeEntityInTags(state, 'studies', action.payload)
    })
    builder.addCase(publishStudyAction, (state, action) => {
      const study = state.bible.studies[action.payload.id]
      study.published = action.payload.publish
      study.modified_at = Date.now()
    })

    // Tags
    builder.addCase(addTag, (state, action) => {
      const { id, name } = action.payload
      state.bible.tags[id] = {
        id,
        date: Date.now(),
        name,
      }
    })
    builder.addCase(updateTag, (state, action) => {
      const { id, value } = action.payload
      state.bible.tags[id].name = value

      entitiesArray.forEach(ent => {
        const entities = state.bible[ent]
        Object.values(entities).forEach((entity: any) => {
          const entityTags = entity.tags
          if (entityTags && entityTags[id]) {
            entityTags[id].name = value
          }
        })
      })
    })
    builder.addCase(removeTag, (state, action) => {
      delete state.bible.tags[action.payload]

      entitiesArray.forEach(ent => {
        const entities = state.bible[ent]
        Object.values(entities).forEach((entity: any) => {
          const entityTags = entity.tags
          if (entityTags && entityTags[action.payload]) {
            delete entityTags[action.payload]
          }
        })
      })
    })
    builder.addCase(toggleTagEntity, (state, action) => {
      const { item, tagId } = action.payload
      // Use type assertion for dynamic entity access
      const entityCollection = state.bible[item.entity] as unknown as BibleEntityCollection

      if (item.ids) {
        const firstId = Object.keys(item.ids)[0]
        const hasTag = entityCollection[firstId]?.tags?.[tagId]

        Object.keys(item.ids).forEach(id => {
          // DELETE OPERATION - In order to have a true toggle, check only for first item with Object.keys(item.ids)[0]
          if (hasTag) {
            try {
              delete state.bible.tags[tagId][item.entity]?.[id]
              delete entityCollection[id].tags?.[tagId]

              // Delete highlight if it has no color and no remaining tags
              if (item.entity === 'highlights') {
                const highlight = state.bible.highlights[id]
                if (
                  highlight &&
                  highlight.color === '' &&
                  Object.keys(highlight.tags || {}).length === 0
                ) {
                  delete state.bible.highlights[id]
                }
              }
            } catch {}

            // ADD OPERATION
          } else {
            if (!state.bible.tags[tagId][item.entity]) {
              state.bible.tags[tagId][item.entity] = {}
            }
            state.bible.tags[tagId][item.entity]![id] = true

            // Create highlight if it doesn't exist (for highlights entity only)
            if (item.entity === 'highlights' && !state.bible.highlights[id]) {
              state.bible.highlights[id] = {
                color: '',
                date: Date.now(),
                tags: {},
              }
            }

            if (!entityCollection[id]) {
              entityCollection[id] = { tags: {} }
            }
            if (!entityCollection[id].tags) {
              entityCollection[id].tags = {}
            }
            entityCollection[id].tags![tagId] = {
              id: tagId,
              name: state.bible.tags[tagId].name,
            }
          }
        })
      } else {
        const entityId = item.id!
        if (!entityCollection[entityId]) {
          entityCollection[entityId] = {
            id: item.id,
            title: item.title,
            tags: {},
          }
        }

        // DELETE OPERATION
        if (entityCollection[entityId]?.tags?.[tagId]) {
          delete state.bible.tags[tagId][item.entity]?.[entityId]
          delete entityCollection[entityId].tags?.[tagId]

          // If words / strongs / nave, delete unused entity
          if (['naves', 'strongsHebreu', 'strongsGrec', 'words'].includes(item.entity)) {
            const hasTags = Object.keys(entityCollection[entityId].tags || {}).length

            if (!hasTags) {
              delete entityCollection[entityId]
            }
          }

          // ADD OPERATION
        } else {
          if (!state.bible.tags[tagId][item.entity]) {
            state.bible.tags[tagId][item.entity] = {}
          }
          state.bible.tags[tagId][item.entity]![entityId] = true

          if (!entityCollection[entityId].tags) {
            entityCollection[entityId].tags = {}
          }
          entityCollection[entityId].tags![tagId] = {
            id: tagId,
            name: state.bible.tags[tagId].name,
          }
        }
      }
    })

    // Version Update
    builder.addCase(setVersionUpdated, (state, action) => {
      state.needsUpdate[action.payload] = false
    })
    builder.addCase(getVersionUpdate.fulfilled, (state, action) => {
      state.needsUpdate = { ...state.needsUpdate, ...action.payload }
    })
    builder.addCase(getDatabaseUpdate.fulfilled, (state, action) => {
      state.needsUpdate = { ...state.needsUpdate, ...action.payload }
    })
  },
})

// Export actions
export const {
  verifyEmail,
  setFontFamily,
  saveAllLogsAsSeen,
  onUserLoginSuccess,
  onUserLogout,
  onUserUpdateProfile,
  receiveLiveUpdates,
  receiveSubcollectionUpdates,
  importData,
  setNotificationVOD,
  setNotificationId,
  toggleCompareVersion,
  resetCompareVersion,
  addChangelog,
  getChangelogFail,
  appFetchData,
  appFetchDataFail,
} = userSlice.actions

// Export action type constants for backward compatibility
export const USER_LOGIN_SUCCESS = onUserLoginSuccess.type
export const USER_UPDATE_PROFILE = onUserUpdateProfile.type
export const USER_LOGOUT = onUserLogout.type
export const SAVE_ALL_LOGS_AS_SEEN = saveAllLogsAsSeen.type
export const SET_NOTIFICATION_VOD = setNotificationVOD.type
export const SET_NOTIFICATION_ID = setNotificationId.type
export const TOGGLE_COMPARE_VERSION = toggleCompareVersion.type
export const RESET_COMPARE_VERSION = resetCompareVersion.type
export const GET_CHANGELOG_SUCCESS = addChangelog.type
export const GET_CHANGELOG_FAIL = getChangelogFail.type
export const SET_FONT_FAMILY = setFontFamily.type
export const APP_FETCH_DATA = appFetchData.type
export const APP_FETCH_DATA_FAIL = appFetchDataFail.type
export const EMAIL_VERIFIED = verifyEmail.type
export const RECEIVE_LIVE_UPDATES = receiveLiveUpdates.type
export const RECEIVE_SUBCOLLECTION_UPDATES = receiveSubcollectionUpdates.type
export const IMPORT_DATA = importData.type
export const GET_CHANGELOG = 'user/GET_CHANGELOG'

// Changelog thunk
export function getChangelog(): ThunkAction<Promise<void>, RootState, undefined, AnyAction> {
  return async (dispatch, getState) => {
    dispatch({ type: GET_CHANGELOG })
    const lastChangelog = getState().user.changelog.lastSeen.toString()
    const changelogDoc = firebaseDb
      .collection('changelog')
      .where('date', '>', lastChangelog)
      .orderBy('date', 'desc')
      .limit(20)

    try {
      const querySnapshot = await changelogDoc.get({ source: 'server' })

      const changelog: ChangelogItem[] = []
      querySnapshot.forEach(doc => {
        changelog.push(doc.data() as ChangelogItem)
      })

      dispatch(addChangelog(changelog))
    } catch (e) {
      console.log(e)
      dispatch(getChangelogFail())
    }
  }
}

export default userSlice.reducer
