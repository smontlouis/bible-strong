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
  REMOVE_NOTE,
  ADD_TAG,
  REMOVE_TAG,
  TOGGLE_TAG_ENTITY,
  UPLOAD_STUDY,
  DELETE_STUDY,
  UPDATE_TAG,
  CHANGE_COLOR,
  SET_HISTORY,
  DELETE_HISTORY,
  UPDATE_USER_DATA,
} from './modules/user'

// TODO - DO IT FOR COLOR SETTINGS ?

import { firebaseDb } from '../helpers/firebase'
import { markAsRead, resetPlan, fetchPlan, removePlan } from './modules/plan'
import { RootState } from '~redux/modules/reducer'

const r = obj => JSON.parse(JSON.stringify(obj)) // Remove undefined variables

export default store => next => async action => {
  const result = next(action)
  const state = store.getState()

  const isLogged = !!state.user.id

  if (!isLogged) {
    return result
  }

  const { user, plan }: RootState = state
  const userDoc = firebaseDb.collection('users').doc(user.id)
  const studyCollection = firebaseDb.collection('studies')

  switch (action.type) {
    case removePlan.type:
    case fetchPlan.fulfilled.type:
    case resetPlan.type:
    case markAsRead.type: {
      userDoc.update(
        r({
          plan: plan.ongoingPlans,
        })
      )
      break
    }
    case ADD_HIGHLIGHT:
    case REMOVE_HIGHLIGHT: {
      const { highlights } = user.bible
      const { tags } = user.bible
      userDoc.update(
        r({
          'bible.highlights': highlights,
          'bible.tags': tags,
        })
      )
      break
    }
    case UPDATE_TAG:
    case REMOVE_TAG: {
      const { tags, notes, highlights, studies } = user.bible
      userDoc.update(
        r({
          'bible.tags': tags,
          'bible.notes': notes,
          'bible.highlights': highlights,
        })
      )

      const batch = firebaseDb.batch()
      Object.keys(studies).forEach(studyId => {
        const studyDoc = firebaseDb.collection('studies').doc(studyId)
        batch.update(studyDoc, r({ tags: studies[studyId].tags || {} }))
      })
      batch.commit().then(() => console.log('Batch studies success'))
      break
    }
    case ADD_NOTE:
    case REMOVE_NOTE: {
      const { notes } = user.bible
      const { tags } = user.bible
      userDoc.update(
        r({
          'bible.notes': notes,
          'bible.tags': tags,
        })
      )
      break
    }
    case ADD_TAG: {
      const { tags } = user.bible
      userDoc.update(r({ 'bible.tags': tags }))
      break
    }
    case TOGGLE_TAG_ENTITY: {
      const { tags } = user.bible
      userDoc.update(r({ 'bible.tags': tags }))

      // Maybe refacto this ? For now firestore is free we don't care
      const entities = user.bible[action.payload.item.entity]

      if (action.payload.item.entity === 'studies') {
        const study = user.bible.studies[action.payload.item.id]
        studyCollection.doc(study.id).set(r(study))
      } else {
        userDoc.update(r({ [`bible.${action.payload.item.entity}`]: entities }))
      }
      break
    }
    case UPLOAD_STUDY: {
      const studyId = action.payload
      studyCollection.doc(studyId).set(r(user.bible.studies[studyId]))
      break
    }
    case DELETE_STUDY: {
      const studyId = action.payload
      studyCollection.doc(studyId).delete()
      const { tags } = user.bible
      userDoc.update(
        r({
          'bible.tags': tags,
        })
      )
      break
    }
    case USER_UPDATE_PROFILE:
    case USER_LOGIN_SUCCESS: {
      const sanitizeUserBible = ({ changelog, studies, ...rest }) => rest
      userDoc.update(
        r({
          bible: sanitizeUserBible(user.bible),
          plan: plan.ongoingPlans,
        })
      )
      break
    }

    // TODO: When there will be too much data to update.
    case UPDATE_USER_DATA: {
      const {
        changelog,
        highlights,
        notes,
        studies,
        tags,
        history,
        settings,
      } = user.bible
      userDoc.update(
        r({
          'bible.history': history,
          'bible.settings': settings,
        })
      )

      break
    }
    default:
  }

  return result
}
