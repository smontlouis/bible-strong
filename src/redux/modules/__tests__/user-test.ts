/* eslint-env jest */

import reducer, {
  USER_LOGIN_SUCCESS,
  USER_UPDATE_PROFILE,
  USER_LOGOUT,
  SET_FONT_FAMILY,
  SET_NOTIFICATION_VOD,
  SET_NOTIFICATION_ID,
  TOGGLE_COMPARE_VERSION,
  RESET_COMPARE_VERSION,
  GET_CHANGELOG_SUCCESS,
  GET_CHANGELOG_FAIL,
  SET_SUBSCRIPTION,
  EMAIL_VERIFIED,
  APP_FETCH_DATA,
  APP_FETCH_DATA_FAIL,
  SAVE_ALL_LOGS_AS_SEEN,
  RECEIVE_SUBCOLLECTION_UPDATES,
} from '../user'

// Mock external dependencies
jest.mock('~helpers/firebase', () => ({
  firebaseDb: {
    collection: jest.fn(),
  },
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({
    set: jest.fn(),
  })),
}))

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))

// Mock theme imports
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

const getInitialState = () => ({
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
    settings: {
      defaultBibleVersion: 'LSG',
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
        default: { primary: '#000' },
        dark: { primary: '#111' },
        black: { primary: '#222' },
        sepia: { primary: '#333' },
        nature: { primary: '#444' },
        sunset: { primary: '#555' },
        mauve: { primary: '#666' },
        night: { primary: '#777' },
      },
      compare: {
        LSG: true,
      },
      customHighlightColors: [],
    },
  },
})

describe('User Reducer', () => {
  let initialState: ReturnType<typeof getInitialState>

  beforeEach(() => {
    initialState = getInitialState()
  })

  describe('EMAIL_VERIFIED', () => {
    it('should set emailVerified to true', () => {
      const state = { ...initialState, emailVerified: false }
      const newState = reducer(state, { type: EMAIL_VERIFIED })
      expect(newState.emailVerified).toBe(true)
    })
  })

  describe('APP_FETCH_DATA', () => {
    it('should set isLoading to true', () => {
      const state = { ...initialState, isLoading: false }
      const newState = reducer(state, { type: APP_FETCH_DATA })
      expect(newState.isLoading).toBe(true)
    })
  })

  describe('APP_FETCH_DATA_FAIL', () => {
    it('should set isLoading to false', () => {
      const state = { ...initialState, isLoading: true }
      const newState = reducer(state, { type: APP_FETCH_DATA_FAIL })
      expect(newState.isLoading).toBe(false)
    })
  })

  describe('SET_FONT_FAMILY', () => {
    it('should set font family', () => {
      const newState = reducer(initialState, {
        type: SET_FONT_FAMILY,
        payload: 'Roboto',
      })
      expect(newState.fontFamily).toBe('Roboto')
    })
  })

  describe('SET_NOTIFICATION_VOD', () => {
    it('should set verse of the day notification time', () => {
      const newState = reducer(initialState, {
        type: SET_NOTIFICATION_VOD,
        payload: '08:30',
      })
      expect(newState.notifications.verseOfTheDay).toBe('08:30')
    })
  })

  describe('SET_NOTIFICATION_ID', () => {
    it('should set notification id', () => {
      const newState = reducer(initialState, {
        type: SET_NOTIFICATION_ID,
        payload: 'notification-123',
      })
      expect(newState.notifications.notificationId).toBe('notification-123')
    })
  })

  describe('USER_LOGIN_SUCCESS', () => {
    it('should set user profile on login', () => {
      const profile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        provider: 'google.com',
        emailVerified: true,
        createdAt: '2023-01-01',
      }
      const newState = reducer(initialState, {
        type: USER_LOGIN_SUCCESS,
        profile,
      })
      expect(newState.id).toBe('user-123')
      expect(newState.email).toBe('test@example.com')
      expect(newState.displayName).toBe('Test User')
      expect(newState.photoURL).toBe('https://example.com/photo.jpg')
      expect(newState.provider).toBe('google.com')
      expect(newState.emailVerified).toBe(true)
      expect(newState.createdAt).toBe('2023-01-01')
      expect(newState.isLoading).toBe(false)
    })

    it('should not overwrite existing displayName', () => {
      const state = { ...initialState, displayName: 'Existing Name' }
      const profile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'New Name',
        photoURL: '',
        provider: 'email',
        emailVerified: false,
      }
      const newState = reducer(state, { type: USER_LOGIN_SUCCESS, profile })
      expect(newState.displayName).toBe('Existing Name')
    })
  })

  describe('USER_UPDATE_PROFILE', () => {
    it('should update displayName', () => {
      const newState = reducer(initialState, {
        type: USER_UPDATE_PROFILE,
        payload: { displayName: 'Updated Name' },
      })
      expect(newState.displayName).toBe('Updated Name')
    })

    it('should update photoURL', () => {
      const newState = reducer(initialState, {
        type: USER_UPDATE_PROFILE,
        payload: { photoURL: 'https://new-photo.com' },
      })
      expect(newState.photoURL).toBe('https://new-photo.com')
    })

    it('should update emailVerified', () => {
      const newState = reducer(initialState, {
        type: USER_UPDATE_PROFILE,
        payload: { emailVerified: true },
      })
      expect(newState.emailVerified).toBe(true)
    })

    it('should handle profile in action.profile format', () => {
      const newState = reducer(initialState, {
        type: USER_UPDATE_PROFILE,
        profile: { displayName: 'Via Profile' },
      })
      expect(newState.displayName).toBe('Via Profile')
    })
  })

  describe('USER_LOGOUT', () => {
    it('should reset state but keep changelog', () => {
      const loggedInState = {
        ...initialState,
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        bible: {
          ...initialState.bible,
          changelog: { '2023-01-01': true },
          bookmarks: { 'bookmark-1': { id: 'bookmark-1', book: 1, chapter: 1, verse: 1, version: 'LSG', date: Date.now() } },
        },
      }
      const newState = reducer(loggedInState, { type: USER_LOGOUT })

      expect(newState.id).toBe('')
      expect(newState.email).toBe('')
      expect(newState.displayName).toBe('')
      expect(newState.bible.changelog).toEqual({ '2023-01-01': true })
      expect(newState.bible.bookmarks).toEqual({})
    })
  })

  describe('SAVE_ALL_LOGS_AS_SEEN', () => {
    it('should mark all logs as seen', () => {
      const logs = [
        { date: '2023-01-01' },
        { date: '2023-01-02' },
      ]
      const newState = reducer(initialState, {
        type: SAVE_ALL_LOGS_AS_SEEN,
        payload: logs,
      })
      expect(newState.bible.changelog['2023-01-01']).toBe(true)
      expect(newState.bible.changelog['2023-01-02']).toBe(true)
    })
  })

  describe('TOGGLE_COMPARE_VERSION', () => {
    it('should add version when not present', () => {
      const newState = reducer(initialState, {
        type: TOGGLE_COMPARE_VERSION,
        payload: 'OST',
      })
      expect(newState.bible.settings.compare['OST']).toBe(true)
    })

    it('should remove version when present', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            compare: { LSG: true, OST: true },
          },
        },
      }
      const newState = reducer(state, {
        type: TOGGLE_COMPARE_VERSION,
        payload: 'OST',
      })
      expect(newState.bible.settings.compare['OST']).toBeUndefined()
    })
  })

  describe('RESET_COMPARE_VERSION', () => {
    it('should reset compare to single version', () => {
      const state = {
        ...initialState,
        bible: {
          ...initialState.bible,
          settings: {
            ...initialState.bible.settings,
            compare: { LSG: true, OST: true, KJV: true },
          },
        },
      }
      const newState = reducer(state, {
        type: RESET_COMPARE_VERSION,
        payload: 'KJV',
      })
      expect(newState.bible.settings.compare).toEqual({ KJV: true })
    })
  })

  describe('GET_CHANGELOG_SUCCESS', () => {
    it('should add changelog entries and update lastSeen', () => {
      const changelogEntries = [
        { date: '2023-01-01', title: 'Update 1' },
        { date: '2023-01-02', title: 'Update 2' },
      ]
      const newState = reducer(initialState, {
        type: GET_CHANGELOG_SUCCESS,
        payload: changelogEntries,
      })
      expect(newState.changelog.isLoading).toBe(false)
      expect(newState.changelog.data).toEqual(changelogEntries)
      expect(newState.changelog.lastSeen).toBeTruthy()
    })

    it('should append to existing changelog data', () => {
      const state = {
        ...initialState,
        changelog: {
          ...initialState.changelog,
          data: [{ date: '2023-01-01', title: 'Old' }],
        },
      }
      const newState = reducer(state, {
        type: GET_CHANGELOG_SUCCESS,
        payload: [{ date: '2023-01-02', title: 'New' }],
      })
      expect(newState.changelog.data).toHaveLength(2)
    })
  })

  describe('GET_CHANGELOG_FAIL', () => {
    it('should set isLoading to false', () => {
      const newState = reducer(initialState, { type: GET_CHANGELOG_FAIL })
      expect(newState.changelog.isLoading).toBe(false)
    })
  })

  describe('SET_SUBSCRIPTION', () => {
    it('should set subscription type', () => {
      const newState = reducer(initialState, {
        type: SET_SUBSCRIPTION,
        payload: 'premium',
      })
      expect(newState.subscription).toBe('premium')
    })
  })

  describe('RECEIVE_SUBCOLLECTION_UPDATES', () => {
    it('should update bookmarks collection', () => {
      const bookmarksData = {
        'bookmark-1': { id: 'bookmark-1', book: 1, chapter: 1, verse: 1, version: 'LSG', date: Date.now() },
      }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'bookmarks', data: bookmarksData, isInitialLoad: true },
      })
      expect(newState.bible.bookmarks).toEqual(bookmarksData)
    })

    it('should update highlights collection', () => {
      const highlightsData = {
        '1-1-1': { color: 'yellow', tags: {}, date: Date.now() },
      }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'highlights', data: highlightsData, isInitialLoad: true },
      })
      expect(newState.bible.highlights).toEqual(highlightsData)
    })

    it('should update notes collection', () => {
      const notesData = {
        '1-1-1': { title: 'Test', description: 'Note', date: Date.now() },
      }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'notes', data: notesData, isInitialLoad: true },
      })
      expect(newState.bible.notes).toEqual(notesData)
    })

    it('should update links collection', () => {
      const linksData = {
        '1-1-1': { url: 'https://example.com', linkType: 'website', date: Date.now() },
      }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'links', data: linksData, isInitialLoad: true },
      })
      expect(newState.bible.links).toEqual(linksData)
    })

    it('should update tags collection', () => {
      const tagsData = {
        'tag-1': { id: 'tag-1', name: 'Test Tag', date: Date.now() },
      }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'tags', data: tagsData, isInitialLoad: true },
      })
      expect(newState.bible.tags).toEqual(tagsData)
    })

    it('should update strongsHebreu collection', () => {
      const strongsData = { H1: { title: 'Test' } }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'strongsHebreu', data: strongsData, isInitialLoad: true },
      })
      expect(newState.bible.strongsHebreu).toEqual(strongsData)
    })

    it('should update strongsGrec collection', () => {
      const strongsData = { G1: { title: 'Test' } }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'strongsGrec', data: strongsData, isInitialLoad: true },
      })
      expect(newState.bible.strongsGrec).toEqual(strongsData)
    })

    it('should update words collection', () => {
      const wordsData = { word1: { title: 'Test' } }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'words', data: wordsData, isInitialLoad: true },
      })
      expect(newState.bible.words).toEqual(wordsData)
    })

    it('should update naves collection', () => {
      const navesData = { nave1: { title: 'Test' } }
      const newState = reducer(initialState, {
        type: RECEIVE_SUBCOLLECTION_UPDATES,
        payload: { collection: 'naves', data: navesData, isInitialLoad: true },
      })
      expect(newState.bible.naves).toEqual(navesData)
    })
  })
})
