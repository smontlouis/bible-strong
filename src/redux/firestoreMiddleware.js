import {
  ADD_HIGHLIGHT,
  REMOVE_HIGHLIGHT,

  USER_LOGIN_SUCCESS,
  USER_UPDATE_PROFILE,

  SET_SETTINGS_ALIGN_CONTENT,
  INCREASE_SETTINGS_FONTSIZE_SCALE,
  DECREASE_SETTINGS_FONTSIZE_SCALE,
  SET_SETTINGS_TEXT_DISPLAY,
  SET_SETTINGS_THEME,
  SET_SETTINGS_PRESS,
  SET_SETTINGS_NOTES_DISPLAY,

  ADD_NOTE,
  EDIT_NOTE,
  REMOVE_NOTE,

  ADD_TAG,
  REMOVE_TAG,
  TOGGLE_TAG_ENTITY,

  UPLOAD_STUDY,
  DELETE_STUDY
} from './modules/user'

import { firebaseDb } from '../helpers/firebaseDb'

export default store => next => action => {
  const result = next(action)
  const state = store.getState()

  const isLogged = !!state.user.id

  if (!isLogged) {
    console.log('User is not logged, skip firestore')
    return result
  }

  const user = state.user
  const userDoc = firebaseDb.collection('users').doc(user.id)
  const studyCollection = firebaseDb.collection('studies')

  switch (action.type) {
    case ADD_HIGHLIGHT:
    case REMOVE_HIGHLIGHT: {
      const highlights = user.bible.highlights
      const tags = user.bible.tags
      userDoc.update({
        'bible.highlights': highlights,
        'bible.tags': tags
      })
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT:
    case INCREASE_SETTINGS_FONTSIZE_SCALE:
    case DECREASE_SETTINGS_FONTSIZE_SCALE:
    case SET_SETTINGS_TEXT_DISPLAY:
    case SET_SETTINGS_THEME:
    case SET_SETTINGS_PRESS:
    case SET_SETTINGS_NOTES_DISPLAY:
    {
      const settings = user.bible.settings
      userDoc.update({ 'bible.settings': settings })
      break
    }
    case ADD_NOTE:
    case EDIT_NOTE:
    case REMOVE_NOTE: {
      const notes = user.bible.notes
      const tags = user.bible.tags
      userDoc.update({
        'bible.notes': notes,
        'bible.tags': tags
      })
      break
    }
    case ADD_TAG:
    case REMOVE_TAG: {
      const tags = user.bible.tags
      userDoc.update({ 'bible.tags': tags })
      break
    }
    case TOGGLE_TAG_ENTITY: {
      const tags = user.bible.tags
      userDoc.update({ 'bible.tags': tags })

      // Maybe refacto this ? For now firestore is free we don't care
      const entities = user.bible[action.payload.item.entity]

      if (action.payload.item.entity === 'studies') {
        const study = user.bible.studies[action.payload.item.id]
        studyCollection.doc(study.id).set(study)
      } else {
        userDoc.update({ [`bible.${action.payload.item.entity}`]: entities })
      }
      break
    }
    case UPLOAD_STUDY: {
      const studyId = action.payload
      studyCollection.doc(studyId).set(user.bible.studies[studyId])
      break
    }
    case DELETE_STUDY: {
      const studyId = action.payload
      studyCollection.doc(studyId).delete()
      const tags = user.bible.tags
      userDoc.update({
        'bible.tags': tags
      })
      break
    }
    case USER_UPDATE_PROFILE:
    case USER_LOGIN_SUCCESS: {
      const sanitizeUserBible = ({ changelog, studies, ...rest }) => rest

      userDoc.update({
        ...user,
        bible: sanitizeUserBible(user.bible)
      })
      break
    }
    default:
  }

  return result
}
