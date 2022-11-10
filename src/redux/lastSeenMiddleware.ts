import {
  ADD_HIGHLIGHT,
  REMOVE_HIGHLIGHT,
  USER_LOGIN_SUCCESS,
  USER_UPDATE_PROFILE,
  SET_SETTINGS_ALIGN_CONTENT,
  INCREASE_SETTINGS_FONTSIZE_SCALE,
  DECREASE_SETTINGS_FONTSIZE_SCALE,
  SET_SETTINGS_TEXT_DISPLAY,
  SET_SETTINGS_PRESS,
  SET_SETTINGS_NOTES_DISPLAY,
  ADD_NOTE,
  REMOVE_NOTE,
  ADD_TAG,
  REMOVE_TAG,
  TOGGLE_TAG_ENTITY,
  DELETE_STUDY,
  UPDATE_TAG,
  CHANGE_COLOR,
  DELETE_HISTORY,
  SET_LAST_SEEN,
  UPDATE_STUDY,
  CREATE_STUDY,
} from './modules/user'

export default store => next => action => {
  const result = next(action)

  switch (action.type) {
    case ADD_HIGHLIGHT:
    case REMOVE_HIGHLIGHT:
    case USER_UPDATE_PROFILE:
    case SET_SETTINGS_ALIGN_CONTENT:
    case INCREASE_SETTINGS_FONTSIZE_SCALE:
    case DECREASE_SETTINGS_FONTSIZE_SCALE:
    case SET_SETTINGS_TEXT_DISPLAY:
    case SET_SETTINGS_PRESS:
    case SET_SETTINGS_NOTES_DISPLAY:
    case ADD_NOTE:
    case REMOVE_NOTE:
    case ADD_TAG:
    case REMOVE_TAG:
    case TOGGLE_TAG_ENTITY:
    case UPDATE_STUDY:
    case CREATE_STUDY:
    case DELETE_STUDY:
    case UPDATE_TAG:
    case CHANGE_COLOR:
    case USER_LOGIN_SUCCESS:
    case DELETE_HISTORY: {
      console.log('lastSeenMiddleware', action.type)
      store.dispatch({ type: SET_LAST_SEEN })
      break
    }
    default: {
      break
    }
  }

  return result
}
