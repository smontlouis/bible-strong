import produce from 'immer'
import deepmerge from 'deepmerge'
import Sentry from 'sentry-expo'

import { clearSelectedVerses } from './bible'

import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'

import orderVerses from '~helpers/orderVerses'
import generateUUID from '~helpers/generateUUID'

export const USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS'
export const USER_UPDATE_PROFILE = 'USER_UPDATE_PROFILE'
export const USER_LOGOUT = 'USER_LOGOUT'

export const ADD_HIGHLIGHT = 'user/ADD_HIGHLIGHT'
export const REMOVE_HIGHLIGHT = 'user/REMOVE_HIGHLIGHT'

export const SET_SETTINGS_ALIGN_CONTENT = 'user/SET_SETTINGS_ALIGN_CONTENT'
export const INCREASE_SETTINGS_FONTSIZE_SCALE = 'user/INCREASE_SETTINGS_FONTSIZE_SCALE'
export const DECREASE_SETTINGS_FONTSIZE_SCALE = 'user/DECREASE_SETTINGS_FONTSIZE_SCALE'
export const SET_SETTINGS_TEXT_DISPLAY = 'user/SET_SETTINGS_TEXT_DISPLAY'
export const SET_SETTINGS_THEME = 'user/SET_SETTINGS_THEME'
export const SET_SETTINGS_PRESS = 'user/SET_SETTINGS_PRESS'
export const SET_SETTINGS_NOTES_DISPLAY = 'user/SET_SETTINGS_NOTES_DISPLAY'

export const ADD_NOTE = 'user/ADD_NOTE'
export const EDIT_NOTE = 'user/EDIT_NOTE'
export const REMOVE_NOTE = 'user/REMOVE_NOTE'

export const SAVE_ALL_LOGS_AS_SEEN = 'user/SAVE_ALL_LOGS_AS_SEEN'

export const ADD_TAG = 'user/ADD_TAG'
export const TOGGLE_TAG_ENTITY = 'TOGGLE_TAG_ENTITY'
export const UPDATE_TAG = 'user/UPDATE_TAG'
export const REMOVE_TAG = 'user/REMOVE_TAG'

export const CREATE_STUDY = 'user/CREATE_STUDY'
export const UPDATE_STUDY = 'user/UPDATE_STUDY'
export const UPLOAD_STUDY = 'user/UPLOAD_STUDY'
export const DELETE_STUDY = 'user/DELETE_STUDY'

export const CHANGE_COLOR = 'user/CHANGE_COLOR'

export const SET_HISTORY = 'SET_HISTORY'
export const DELETE_HISTORY = 'DELETE_HISTORY'
export const UPDATE_USER_DATA = 'UPDATE_USER_DATA'

const initialState = {
  id: '',
  email: '',
  displayName: '',
  photoURL: '',
  provider: '',
  lastSeen: 0,
  emailVerified: false,
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
      colors: {
        default: defaultColors,
        dark: darkColors
      }
    }
  }
}

const addDateAndColorToVerses = (verses, highlightedVerses, color) => {
  const formattedObj = Object.keys(verses).reduce(
    (obj, verse) => ({
      ...obj,
      [verse]: {
        color,
        date: Date.now(),
        ...(highlightedVerses[verse] && {
          tags: highlightedVerses[verse].tags || {}
        })
      }
    }),
    {}
  )

  return formattedObj
}

const removeEntityInTags = (draft, entity, key) => {
  for (const tag in draft.bible.tags) {
    if (draft.bible.tags[tag][entity]) {
      delete draft.bible.tags[tag][entity][key]
    }
  }
}

const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray

// UserReducer
export default produce((draft, action) => {
  switch (action.type) {
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
        bible
      } = action.profile

      draft.id = id
      draft.email = email
      draft.displayName = displayName
      draft.photoURL = photoURL
      draft.provider = provider
      draft.lastSeen = lastSeen
      draft.emailVerified = emailVerified

      if (bible) {
        draft.bible = deepmerge(draft.bible, bible, { arrayMerge: overwriteMerge })

        // Now take care of studies
        if (action.studies && Object.keys(action.studies).length) {
          if (draft.bible.studies) {
            Object.keys(action.studies).forEach(remoteStudyId => {
              if (draft.bible.studies[remoteStudyId]) {
                // We have a conflict here
                console.log(`We have a conflict with ${remoteStudyId}, pick by modified_date`)
                const localModificationDate = draft.bible.studies[remoteStudyId].modified_at
                const remoteModificationDate = action.studies[remoteStudyId].modified_at
                if (remoteModificationDate > localModificationDate) {
                  console.log('Remote date is recent')
                  draft.bible.studies[remoteStudyId] = action.studies[remoteStudyId]
                }
              } else {
                // No conflicts, just put that study in there
                console.log(`No conflicts for ${remoteStudyId}, just put that story in there`)
                draft.bible.studies[remoteStudyId] = action.studies[remoteStudyId]
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
          changelog: draft.bible.changelog
        }
      }
    }
    case ADD_NOTE: {
      draft.bible.notes = {
        ...draft.bible.notes,
        ...action.payload
      }
      break
    }
    case REMOVE_NOTE: {
      delete draft.bible.notes[action.payload]
      removeEntityInTags(draft, 'notes', action.payload)
      break
    }
    case ADD_HIGHLIGHT: {
      draft.bible.highlights = {
        ...draft.bible.highlights,
        ...action.selectedVerses
      }
      break
    }
    case REMOVE_HIGHLIGHT: {
      Object.keys(action.selectedVerses).forEach(key => {
        delete draft.bible.highlights[key]
        removeEntityInTags(draft, 'highlights', key)
      })
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT: {
      draft.bible.settings.alignContent = action.payload
      break
    }
    case SET_SETTINGS_TEXT_DISPLAY: {
      draft.bible.settings.textDisplay = action.payload
      break
    }
    case SET_SETTINGS_THEME: {
      draft.bible.settings.theme = action.payload
      break
    }
    case SET_SETTINGS_PRESS: {
      draft.bible.settings.press = action.payload
      break
    }
    case SET_SETTINGS_NOTES_DISPLAY: {
      draft.bible.settings.notesDisplay = action.payload
      break
    }
    case INCREASE_SETTINGS_FONTSIZE_SCALE: {
      if (draft.bible.settings.fontSizeScale < 3) {
        draft.bible.settings.fontSizeScale += 1
      }
      break
    }
    case DECREASE_SETTINGS_FONTSIZE_SCALE: {
      if (draft.bible.settings.fontSizeScale > -3) {
        draft.bible.settings.fontSizeScale -= 1
      }
      break
    }
    case SAVE_ALL_LOGS_AS_SEEN: {
      action.payload.map(log => {
        draft.bible.changelog[log.date] = true
      })
      break
    }
    case ADD_TAG: {
      const tagId = generateUUID()
      draft.bible.tags[tagId] = {
        id: tagId,
        date: Date.now(),
        name: action.payload
      }
      break
    }
    case UPDATE_TAG: {
      draft.bible.tags[action.id].name = action.value
      const entitiesArray = ['highlights', 'notes', 'studies']

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach(entity => {
          const entityTags = entity.tags
          if (entityTags && entityTags[action.id]) {
            entityTags[action.id].name = action.value
          }
        })
      })

      break
    }
    case REMOVE_TAG: {
      delete draft.bible.tags[action.payload]

      const entitiesArray = ['highlights', 'notes', 'studies']

      entitiesArray.forEach(ent => {
        const entities = draft.bible[ent]
        Object.values(entities).forEach(entity => {
          const entityTags = entity.tags
          if (entityTags && entityTags[action.payload]) {
            delete entityTags[action.payload]
          }
        })
      })
      break
    }
    case TOGGLE_TAG_ENTITY: {
      const { item, tagId } = action.payload

      if (item.ids) {
        const hasTag =
          draft.bible[item.entity][Object.keys(item.ids)[0]].tags &&
          draft.bible[item.entity][Object.keys(item.ids)[0]].tags[tagId]

        Object.keys(item.ids).forEach(id => {
          // DELETE OPERATION - In order to have a true toggle, check only for first item with Object.keys(item.ids)[0]
          if (hasTag) {
            try {
              delete draft.bible.tags[tagId][item.entity][id]
              delete draft.bible[item.entity][id].tags[tagId]
            } catch (e) {
              Sentry.captureException(e)
            }

            // ADD OPERATION
          } else {
            if (!draft.bible.tags[tagId][item.entity]) {
              draft.bible.tags[tagId][item.entity] = {}
            }
            draft.bible.tags[tagId][item.entity][id] = true

            if (!draft.bible[item.entity][id].tags) {
              draft.bible[item.entity][id].tags = {}
            }
            draft.bible[item.entity][id].tags[tagId] = {
              id: tagId,
              name: draft.bible.tags[tagId].name
            }
          }
        })
      } else {
        // DELETE OPERATION
        if (
          draft.bible[item.entity][item.id].tags &&
          draft.bible[item.entity][item.id].tags[tagId]
        ) {
          delete draft.bible.tags[tagId][item.entity][item.id]
          delete draft.bible[item.entity][item.id].tags[tagId]
          // ADD OPERATION
        } else {
          if (!draft.bible.tags[tagId][item.entity]) {
            draft.bible.tags[tagId][item.entity] = {}
          }
          draft.bible.tags[tagId][item.entity][item.id] = true

          if (!draft.bible[item.entity][item.id].tags) {
            draft.bible[item.entity][item.id].tags = {}
          }
          draft.bible[item.entity][item.id].tags[tagId] = {
            id: tagId,
            name: draft.bible.tags[tagId].name
          }
        }
      }

      break
    }
    case CREATE_STUDY: {
      draft.bible.studies[action.payload] = {
        id: action.payload,
        created_at: Date.now(),
        modified_at: Date.now(),
        title: 'Document sans titre',
        content: null,
        user: {
          id: draft.id,
          displayName: draft.displayName,
          photoUrl: draft.photoURL
        }
      }
      break
    }
    case UPDATE_STUDY: {
      const study = draft.bible.studies[action.payload.id]
      if (study) {
        study.modified_at = Date.now()
        if (action.payload.content) study.content = action.payload.content
        if (action.payload.title) study.title = action.payload.title

        // Just in case
        study.user = {
          id: draft.id,
          displayName: draft.displayName,
          photoUrl: draft.photoURL
        }
      } else {
        throw new Error(`Cannot find study: ${action.payload.id}`)
      }
      break
    }
    case DELETE_STUDY: {
      delete draft.bible.studies[action.payload]
      removeEntityInTags(draft, 'studies', action.payload)
      break
    }
    case CHANGE_COLOR: {
      const currentTheme = draft.bible.settings.theme
      const color =
        action.color ||
        (currentTheme === 'dark' ? darkColors[action.name] : defaultColors[action.name])
      draft.bible.settings.colors[currentTheme][action.name] = color
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
        date: Date.now()
      })
      draft.bible.history = draft.bible.history.slice(0, 50)
      break
    }
    default: {
      break
    }
  }
}, initialState)

// NOTES
export function addNote(note, noteVerses) {
  return (dispatch, getState) => {
    let selectedVerses = noteVerses || getState().bible.selectedVerses
    selectedVerses = orderVerses(selectedVerses)
    const key = Object.keys(selectedVerses).join('/')
    dispatch(clearSelectedVerses())

    if (!key) return
    return dispatch({ type: ADD_NOTE, payload: { [key]: note } })
  }
}

export function deleteNote(noteId) {
  return {
    type: REMOVE_NOTE,
    payload: noteId
  }
}

// HIGHLIGHTS

export function addHighlight(color) {
  return (dispatch, getState) => {
    const { selectedVerses } = getState().bible
    const highlightedVerses = getState().user.bible.highlights

    dispatch(clearSelectedVerses())
    return dispatch({
      type: ADD_HIGHLIGHT,
      selectedVerses: addDateAndColorToVerses(selectedVerses, highlightedVerses, color)
    })
  }
}

export function removeHighlight() {
  return (dispatch, getState) => {
    const { selectedVerses } = getState().bible

    dispatch(clearSelectedVerses())
    return dispatch({ type: REMOVE_HIGHLIGHT, selectedVerses })
  }
}

// SETTINGS

export function setSettingsAlignContent(payload) {
  return {
    type: SET_SETTINGS_ALIGN_CONTENT,
    payload
  }
}

export function setSettingsTextDisplay(payload) {
  return {
    type: SET_SETTINGS_TEXT_DISPLAY,
    payload
  }
}

export function setSettingsTheme(payload) {
  return {
    type: SET_SETTINGS_THEME,
    payload
  }
}

export function setSettingsNotesDisplay(payload) {
  return {
    type: SET_SETTINGS_NOTES_DISPLAY,
    payload
  }
}

export function increaseSettingsFontSizeScale() {
  return {
    type: INCREASE_SETTINGS_FONTSIZE_SCALE
  }
}

export function decreaseSettingsFontSizeScale() {
  return {
    type: DECREASE_SETTINGS_FONTSIZE_SCALE
  }
}

export function setSettingsPress(payload) {
  return {
    type: SET_SETTINGS_PRESS,
    payload
  }
}

export function saveAllLogsAsSeen(payload) {
  return {
    type: SAVE_ALL_LOGS_AS_SEEN,
    payload
  }
}

// TAGS

export function addTag(payload) {
  return {
    type: ADD_TAG,
    payload
  }
}

export function updateTag(id, value) {
  return {
    type: UPDATE_TAG,
    id,
    value
  }
}

export function removeTag(payload) {
  return {
    type: REMOVE_TAG,
    payload
  }
}

export function toggleTagEntity({ item, tagId }) {
  return {
    type: TOGGLE_TAG_ENTITY,
    payload: { item, tagId }
  }
}

// STUDIES

export function createStudy(id) {
  return {
    type: CREATE_STUDY,
    payload: id
  }
}

export function updateStudy({ id, content, title }) {
  return {
    type: UPDATE_STUDY,
    payload: { id, content, title }
  }
}

export function uploadStudy(id) {
  return {
    type: UPLOAD_STUDY,
    payload: id
  }
}

export function deleteStudy(id) {
  return {
    type: DELETE_STUDY,
    payload: id
  }
}

// USERS

export function onUserLoginSuccess(profile, studies) {
  return {
    type: USER_LOGIN_SUCCESS,
    profile,
    studies
  }
}

export function onUserLogout() {
  return {
    type: USER_LOGOUT
  }
}

export function onUserUpdateProfile(profile) {
  return {
    type: USER_UPDATE_PROFILE,
    payload: profile
  }
}

export function changeColor({ name, color }) {
  return {
    type: CHANGE_COLOR,
    name,
    color
  }
}

// HISTORY

export function setHistory(item) {
  return {
    type: SET_HISTORY,
    payload: item
  }
}

export function deleteHistory() {
  return {
    type: DELETE_HISTORY
  }
}

export function updateUserData() {
  return {
    type: UPDATE_USER_DATA
  }
}
