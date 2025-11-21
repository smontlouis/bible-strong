import firestore from '@react-native-firebase/firestore'
import auth from '@react-native-firebase/auth'
import NetInfo from '@react-native-community/netinfo'
import * as Sentry from '@sentry/react-native'
import { tokenManager } from '~helpers/TokenManager'
import {
  USER_UPDATE_PROFILE,
  //
  SET_SETTINGS_ALIGN_CONTENT,
  SET_SETTINGS_LINE_HEIGHT,
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
  //
  IMPORT_DATA,
} from './modules/user'

import { firebaseDb } from '../helpers/firebase'
import { markAsRead, resetPlan, fetchPlan, removePlan } from './modules/plan'
import { RootState } from '~redux/modules/reducer'
import { diff } from '~helpers/deep-obj'
import Snackbar from '~common/SnackBar'
import i18n from '~i18n'

export const r = (obj) => JSON.parse(JSON.stringify(obj)) // Remove undefined variables

export default (store) => (next) => async (action) => {
  const oldState = store.getState()
  const result = next(action)
  const state = store.getState()

  const diffState: any = diff(oldState, state, firestore.FieldValue.delete())

  // FIX BUG #1: Vérifier Firebase Auth au lieu de Redux user.id
  const currentUser = auth().currentUser

  if (!currentUser || !state.user.id) {
    // Pas d'utilisateur Firebase Auth authentifié
    return result
  }

  // PAS de force refresh systématique - le SDK Firestore le gère automatiquement
  // On fait confiance au SDK sauf si on détecte un problème (voir error handling plus bas)

  const { user, plan }: RootState = state
  const userDoc = firebaseDb.collection('users').doc(currentUser.uid)

  switch (action.type) {
    // case IMPORT_DATA:
    case removePlan.type:
    case fetchPlan.fulfilled.type:
    case resetPlan.type:
    case markAsRead.type: {
      try {
        await userDoc.set(
          {
            plan: plan.ongoingPlans,
          },
          { merge: true }
        )
      } catch (error) {
        console.log('error', error)
        Snackbar.show(i18n.t('app.syncError'), 'danger')
      }
      break
    }
    case SET_SETTINGS_ALIGN_CONTENT:
    case SET_SETTINGS_LINE_HEIGHT:
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
    case IMPORT_DATA:
    case UPDATE_TAG: {
      if (!diffState?.user?.bible) break

      const { studies, ...diffStateUserBible } = diffState.user.bible

      if (Object.keys(diffStateUserBible).length !== 0) {
        try {
          await userDoc.set({ bible: diffStateUserBible }, { merge: true })
        } catch (error: any) {
          console.error('[Sync] User bible sync failed:', error)

          // SAFETY NET: Si permission-denied, tente un refresh manuel du token
          // (cas edge où SDK n'a pas eu le temps de refresh après background prolongé)
          if (error.code === 'permission-denied') {
            console.warn(
              '[Sync] Permission denied detected, attempting manual token refresh...'
            )

            const refreshed = await tokenManager.tryRefresh()

            if (refreshed) {
              // Retry l'opération après refresh
              try {
                await userDoc.set(
                  { bible: diffStateUserBible },
                  { merge: true }
                )
                console.log('[Sync] Retry succeeded after token refresh')
                return // Success, pas besoin de snackbar
              } catch (retryError: any) {
                console.error(
                  '[Sync] Retry failed after token refresh:',
                  retryError
                )
                Sentry.captureException(retryError, {
                  tags: { feature: 'sync', action: 'retry_after_refresh' },
                  extra: { userId: currentUser.uid, originalError: error.code },
                })
              }
            }
          }

          // Afficher erreur seulement si retry a échoué ou autre type d'erreur
          Sentry.captureException(error, {
            tags: { feature: 'sync', action: 'user_bible_sync' },
            extra: { userId: currentUser.uid, errorCode: error.code },
          })
          Snackbar.show(i18n.t('app.syncError'), 'danger')
        }
      }

      if (studies) {
        // FIX BUG #2: Utiliser Promise.all avec await pour garantir la synchronisation
        try {
          await Promise.all(
            Object.entries(studies).map(async ([studyId, obj]) => {
              const studyDoc = firebaseDb.collection('studies').doc(studyId)
              const studyContent =
                state.user.bible.studies[studyId]?.content?.ops

              try {
                await studyDoc.set(
                  {
                    ...obj,
                    content: {
                      // handle array weird form from diff object
                      ops: studyContent || [],
                    },
                  },
                  { merge: true }
                )
                console.log(`Study ${studyId} synced successfully`)
              } catch (studyError) {
                // FIX BUG #3: Logger les erreurs au lieu de les avaler
                console.error(`Failed to sync study ${studyId}:`, studyError)
                Sentry.captureException(studyError, {
                  tags: {
                    feature: 'sync',
                    action: 'study_sync',
                    studyId,
                  },
                  extra: {
                    userId: currentUser.uid,
                    studyTitle: obj?.title || 'unknown',
                  },
                })
                // Re-throw pour que Promise.all catch l'erreur
                throw studyError
              }
            })
          )
        } catch (studiesError) {
          console.error('Studies sync failed:', studiesError)
          Snackbar.show(i18n.t('app.syncError'), 'danger')
          // Note: Les études restent dans l'état local et seront retentées au prochain changement
        }
      }

      break
    }
    case DELETE_STUDY: {
      if (!diffState?.user?.bible) return
      const { studies } = diffState.user.bible

      if (studies) {
        // FIX BUG #2: Utiliser Promise.all avec await pour garantir la suppression
        try {
          await Promise.all(
            Object.entries(studies).map(async ([studyId]) => {
              const studyDocRef = firebaseDb.collection('studies').doc(studyId)

              try {
                const studyDoc = await studyDocRef.get()
                if (!studyDoc.exists) {
                  console.log(`Study ${studyId} already deleted`)
                  return
                }

                await studyDocRef.delete()
                console.log(`Study ${studyId} deleted successfully`)
              } catch (deleteError) {
                console.error(`Failed to delete study ${studyId}:`, deleteError)
                Sentry.captureException(deleteError, {
                  tags: {
                    feature: 'sync',
                    action: 'study_delete',
                    studyId,
                  },
                  extra: { userId: currentUser.uid },
                })
                throw deleteError
              }
            })
          )
        } catch (deletionError) {
          console.error('Studies deletion failed:', deletionError)
          Snackbar.show(i18n.t('app.syncError'), 'danger')
        }
      }
      break
    }
    case USER_UPDATE_PROFILE:
    case SET_SUBSCRIPTION: {
      // FIX BUG #2: Ajouter await pour garantir la synchronisation
      try {
        await userDoc.set({ subscription: user.subscription }, { merge: true })
        console.log('Subscription synced successfully')
      } catch (subError) {
        console.error('Subscription sync failed:', subError)
        Sentry.captureException(subError, {
          tags: { feature: 'sync', action: 'subscription_update' },
          extra: { userId: currentUser.uid },
        })
        Snackbar.show(i18n.t('app.syncError'), 'danger')
      }
      break
    }
    default:
  }

  return result
}
