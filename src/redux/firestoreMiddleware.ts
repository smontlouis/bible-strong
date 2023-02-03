import firestore from '@react-native-firebase/firestore'
import {
  USER_UPDATE_PROFILE,
  //
  SET_SETTINGS_ALIGN_CONTENT,
  INCREASE_SETTINGS_FONTSIZE_SCALE,
  DECREASE_SETTINGS_FONTSIZE_SCALE,
  SET_SETTINGS_TEXT_DISPLAY,
  SET_SETTINGS_PRESS,
  SET_SETTINGS_NOTES_DISPLAY,
  SET_SETTINGS_COMMENTS_DISPLAY,
  //
  CHANGE_COLOR,
  //
  ADD_NOTE,
  REMOVE_NOTE,
  //
  ADD_TAG,
  REMOVE_TAG,
  TOGGLE_TAG_ENTITY,
  UPDATE_TAG,
  //
  CREATE_STUDY,
  UPDATE_STUDY,
  DELETE_STUDY,
  PUBLISH_STUDY,
  //
  //
  ADD_HIGHLIGHT,
  REMOVE_HIGHLIGHT,
  CHANGE_HIGHLIGHT_COLOR,
  //
  TOGGLE_COMPARE_VERSION,
  RESET_COMPARE_VERSION,
  //
  SET_SUBSCRIPTION,
  SET_SETTINGS_PREFERRED_DARK_THEME,
  SET_SETTINGS_PREFERRED_LIGHT_THEME,
  SET_SETTINGS_PREFERRED_COLOR_SCHEME,
  //
  TOGGLE_SETTINGS_SHARE_APP_NAME,
  TOGGLE_SETTINGS_SHARE_INLINE_VERSES,
  TOGGLE_SETTINGS_SHARE_QUOTES,
  TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS,
  SAVE_ALL_LOGS_AS_SEEN,
} from './modules/user'

import { firebaseDb } from '../helpers/firebase'
import { markAsRead, resetPlan, fetchPlan, removePlan } from './modules/plan'
import { RootState } from '~redux/modules/reducer'
import { diff } from '~helpers/deep-obj'

export const r = obj => JSON.parse(JSON.stringify(obj)) // Remove undefined variables

export default store => next => async action => {
  const oldState = store.getState()
  const result = next(action)
  const state = store.getState()

  const diffState: any = diff(oldState, state, firestore.FieldValue.delete())

  const isLogged = !!state.user.id

  if (!isLogged) {
    return result
  }

  const { user, plan }: RootState = state
  const userDoc = firebaseDb.collection('users').doc(user.id)

  switch (action.type) {
    case removePlan.type:
    case fetchPlan.fulfilled.type:
    case resetPlan.type:
    case markAsRead.type: {
      userDoc.set(
        {
          plan: plan.ongoingPlans,
        },
        { merge: true }
      )
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT:
    case INCREASE_SETTINGS_FONTSIZE_SCALE:
    case DECREASE_SETTINGS_FONTSIZE_SCALE:
    case SET_SETTINGS_TEXT_DISPLAY:
    case SET_SETTINGS_PREFERRED_DARK_THEME:
    case SET_SETTINGS_PREFERRED_LIGHT_THEME:
    case SET_SETTINGS_PREFERRED_COLOR_SCHEME:
    case SET_SETTINGS_PRESS:
    case SET_SETTINGS_NOTES_DISPLAY:
    case SET_SETTINGS_COMMENTS_DISPLAY:
    case CHANGE_COLOR:
    case CREATE_STUDY:
    case UPDATE_STUDY:
    case PUBLISH_STUDY:
    case ADD_NOTE:
    case REMOVE_NOTE:
    case ADD_HIGHLIGHT:
    case CHANGE_HIGHLIGHT_COLOR:
    case ADD_TAG:
    case REMOVE_HIGHLIGHT:
    case TOGGLE_TAG_ENTITY:
    case TOGGLE_COMPARE_VERSION:
    case RESET_COMPARE_VERSION:
    case REMOVE_TAG:
    case TOGGLE_SETTINGS_SHARE_APP_NAME:
    case TOGGLE_SETTINGS_SHARE_INLINE_VERSES:
    case TOGGLE_SETTINGS_SHARE_QUOTES:
    case TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS:
    case SAVE_ALL_LOGS_AS_SEEN:
    case UPDATE_TAG: {
      if (!diffState?.user?.bible) break

      const { studies, ...diffStateUserBible } = diffState.user.bible

      if (Object.keys(diffStateUserBible).length !== 0) {
        userDoc.set({ bible: diffStateUserBible }, { merge: true })
      }

      if (studies) {
        Object.entries(studies).forEach(([studyId, obj]) => {
          const studyDoc = firebaseDb.collection('studies').doc(studyId)
          const studyContent = state.user.bible.studies[studyId]?.content?.ops
          studyDoc.set(
            {
              ...obj,
              content: {
                // handle array weird form from diff object
                ops: studyContent || [],
              },
            },
            { merge: true }
          )
        })
      }

      break
    }
    case DELETE_STUDY: {
      if (!diffState?.user?.bible) return
      const { studies } = diffState.user.bible

      if (studies) {
        Object.entries(studies).forEach(([studyId]) => {
          const studyDoc = firebaseDb.collection('studies').doc(studyId)
          studyDoc.delete()
        })
      }
      break
    }
    case USER_UPDATE_PROFILE:
    case SET_SUBSCRIPTION: {
      userDoc.set({ subscription: user.subscription }, { merge: true })
      break
    }
    default:
  }

  return result
}
