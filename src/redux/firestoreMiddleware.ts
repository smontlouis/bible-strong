import { getAuth } from '@react-native-firebase/auth'
import * as Sentry from '@sentry/react-native'
import { tokenManager } from '~helpers/TokenManager'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import {
  USER_LOGOUT,
  USER_UPDATE_PROFILE,
  //
  SET_SETTINGS_ALIGN_CONTENT,
  SET_SETTINGS_LINE_HEIGHT,
  INCREASE_SETTINGS_FONTSIZE_SCALE,
  DECREASE_SETTINGS_FONTSIZE_SCALE,
  SET_SETTINGS_TEXT_DISPLAY,
  SET_SETTINGS_PRESS,
  SET_SETTINGS_NOTES_DISPLAY,
  SET_SETTINGS_LINKS_DISPLAY,
  SET_SETTINGS_COMMENTS_DISPLAY,
  //
  CHANGE_COLOR,
  //
  ADD_BOOKMARK,
  REMOVE_BOOKMARK,
  UPDATE_BOOKMARK,
  MOVE_BOOKMARK,
  //
  ADD_NOTE,
  REMOVE_NOTE,
  //
  ADD_LINK,
  UPDATE_LINK,
  REMOVE_LINK,
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
  SET_DEFAULT_COLOR_NAME,
  SET_DEFAULT_COLOR_TYPE,
  //
  IMPORT_DATA,
} from './modules/user'
import {
  ADD_CUSTOM_COLOR,
  UPDATE_CUSTOM_COLOR,
  DELETE_CUSTOM_COLOR,
} from './modules/user/customColors'

import { firebaseDb, doc, setDoc, getDoc, deleteDoc, deleteField } from '../helpers/firebase'
import { markAsRead, resetPlan, fetchPlan, removePlan } from './modules/plan'
import { RootState } from '~redux/modules/reducer'
import { diff } from '~helpers/deep-obj'
import { toast } from 'sonner-native'
import i18n from '~i18n'
import {
  type SubcollectionName,
  SUBCOLLECTION_NAMES,
  batchWriteSubcollection,
  type BatchChanges,
} from '~helpers/firestoreSubcollections'
import { migrateImportedDataToSubcollections } from '~helpers/firestoreMigration'

export const removeUndefinedVariables = (obj: any) => JSON.parse(JSON.stringify(obj)) // Remove undefined variables

/**
 * Nettoie un objet pour Firestore en supprimant les valeurs undefined
 * tout en préservant les sentinels Firestore (comme deleteField())
 */
export const cleanForFirestore = (obj: any): any => {
  if (obj === undefined) return undefined
  if (obj === null) return null
  if (typeof obj !== 'object') return obj

  // Préserver les sentinels Firestore (comme deleteField())
  // Les sentinels ont une propriété _methodName ou isEqual
  if (obj._methodName || typeof obj.isEqual === 'function') return obj

  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore).filter(v => v !== undefined)
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const value = cleanForFirestore(obj[key])
    if (value !== undefined) {
      result[key] = value
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Détecte les changements dans une sous-collection à partir du diff
 * Retourne les éléments ajoutés/modifiés et supprimés
 */
function extractSubcollectionChanges(diffData: any, deleteMarker: any): BatchChanges {
  const changes: BatchChanges = {
    set: {},
    delete: [],
  }

  if (!diffData) return changes

  for (const [id, value] of Object.entries(diffData)) {
    if (value === deleteMarker) {
      // Élément supprimé
      changes.delete.push(id)
    } else if (value && typeof value === 'object') {
      // Élément ajouté ou modifié
      changes.set[id] = value
    }
  }

  return changes
}

/**
 * Synchronise les changements d'une sous-collection vers Firestore
 */
async function syncSubcollectionChanges(
  userId: string,
  collection: SubcollectionName,
  diffData: any,
  fullData: any,
  deleteMarker: any
): Promise<void> {
  const changes = extractSubcollectionChanges(diffData, deleteMarker)

  // Pour les modifications, on a besoin des données complètes car le diff ne contient que les champs modifiés
  for (const id of Object.keys(changes.set)) {
    if (fullData && fullData[id]) {
      changes.set[id] = removeUndefinedVariables(fullData[id])

      // For bookmarks: explicitly delete verse field if not present (chapter-level bookmark)
      // This prevents old verse values from persisting due to merge: true
      if (collection === 'bookmarks' && fullData[id].verse === undefined) {
        changes.set[id].verse = deleteMarker
      }
    }
  }

  const totalOps = Object.keys(changes.set).length + changes.delete.length

  if (totalOps === 0) return

  console.log(
    `[Sync] Syncing ${collection}: ${Object.keys(changes.set).length} set, ${changes.delete.length} delete`
  )

  // Utiliser batch pour efficacité
  await batchWriteSubcollection(userId, collection, changes)
}

/**
 * Gère les erreurs de sync avec retry sur permission-denied
 */
async function handleSyncWithRetry(
  operation: () => Promise<void>,
  userId: string,
  actionName: string,
  state: RootState
): Promise<boolean> {
  try {
    await operation()
    return true
  } catch (error: any) {
    console.error(`[Sync] ${actionName} failed:`, error)

    // SAFETY NET: Si permission-denied, tente un refresh manuel du token
    if (error.code === 'permission-denied') {
      console.warn('[Sync] Permission denied detected, attempting manual token refresh...')

      const refreshed = await tokenManager.tryRefresh()

      if (refreshed) {
        try {
          await operation()
          console.log('[Sync] Retry succeeded after token refresh')
          return true
        } catch (retryError: any) {
          console.error('[Sync] Retry failed after token refresh:', retryError)
          Sentry.captureException(retryError, {
            tags: { feature: 'sync', action: 'retry_after_refresh' },
            extra: { userId, originalError: error.code },
          })
        }
      }
    }

    Sentry.captureException(error, {
      tags: { feature: 'sync', action: actionName },
      extra: { userId, errorCode: error.code },
    })

    // SAFETY: Créer un backup immédiat en cas d'erreur de sync
    autoBackupManager.createBackupNow(state, 'sync_error').catch(backupError => {
      console.error('[AutoBackup] Failed to create error backup:', backupError)
    })

    toast.error(i18n.t('app.syncError'))
    return false
  }
}

export default (store: any) => (next: any) => async (action: any) => {
  const oldState = store.getState()
  const result = next(action)

  // Early return for logout - prevent race conditions with app lifecycle
  if (action.type === USER_LOGOUT) {
    return result
  }

  const state = store.getState()

  const deleteMarker = deleteField()
  const diffState: any = diff(oldState, state, deleteMarker)

  // FIX BUG #1: Vérifier Firebase Auth au lieu de Redux user.id
  const currentUser = getAuth().currentUser

  if (!currentUser || !state.user.id) {
    // Pas d'utilisateur Firebase Auth authentifié
    return result
  }

  const userId = currentUser.uid
  const { user, plan }: RootState = state
  const userDocRef = doc(firebaseDb, 'users', userId)

  // Schedule un backup automatique après chaque changement (debounced 30s)
  autoBackupManager.scheduleBackup(state)

  switch (action.type) {
    // ========== PLAN SYNC ==========
    case removePlan.type:
    case fetchPlan.fulfilled.type:
    case resetPlan.type:
    case markAsRead.type: {
      try {
        await setDoc(userDocRef, { plan: plan.ongoingPlans }, { merge: true })
      } catch (error) {
        console.log('[Firestore] Error syncing plan:', error)
        toast.error(i18n.t('app.syncError'))
        Sentry.captureException(error, {
          tags: { feature: 'sync', action: 'plan_sync' },
          extra: { userId },
        })
      }
      break
    }

    // ========== SETTINGS SYNC (reste dans le document user) ==========
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
    case SET_SETTINGS_LINKS_DISPLAY:
    case SET_SETTINGS_COMMENTS_DISPLAY:
    case CHANGE_COLOR:
    case TOGGLE_COMPARE_VERSION:
    case RESET_COMPARE_VERSION:
    case TOGGLE_SETTINGS_SHARE_APP_NAME:
    case TOGGLE_SETTINGS_SHARE_INLINE_VERSES:
    case TOGGLE_SETTINGS_SHARE_QUOTES:
    case TOGGLE_SETTINGS_SHARE_VERSE_NUMBERS:
    case SAVE_ALL_LOGS_AS_SEEN:
    case SET_DEFAULT_COLOR_NAME:
    case SET_DEFAULT_COLOR_TYPE: {
      if (!diffState?.user?.bible?.settings) break

      await handleSyncWithRetry(
        async () => {
          await setDoc(
            userDocRef,
            { bible: { settings: cleanForFirestore(diffState.user.bible.settings) } },
            { merge: true }
          )
        },
        userId,
        'settings_sync',
        state
      )
      break
    }

    // ========== CUSTOM HIGHLIGHT COLORS SYNC ==========
    // Sync le tableau complet (pas le diff) pour éviter les problèmes de merge avec Firestore
    case ADD_CUSTOM_COLOR:
    case UPDATE_CUSTOM_COLOR:
    case DELETE_CUSTOM_COLOR: {
      const customHighlightColors = state.user.bible.settings.customHighlightColors ?? []

      await handleSyncWithRetry(
        async () => {
          await setDoc(
            userDocRef,
            {
              bible: {
                settings: {
                  customHighlightColors: removeUndefinedVariables(customHighlightColors),
                },
              },
            },
            { merge: true }
          )
        },
        userId,
        'custom_colors_sync',
        state
      )
      break
    }

    // ========== BOOKMARKS SYNC (sous-collection) ==========
    case ADD_BOOKMARK:
    case REMOVE_BOOKMARK:
    case UPDATE_BOOKMARK:
    case MOVE_BOOKMARK: {
      if (!diffState?.user?.bible?.bookmarks) break

      await handleSyncWithRetry(
        async () => {
          await syncSubcollectionChanges(
            userId,
            'bookmarks',
            diffState.user.bible.bookmarks,
            user.bible.bookmarks,
            deleteMarker
          )
        },
        userId,
        'bookmarks_sync',
        state
      )
      break
    }

    // ========== NOTES SYNC (sous-collection) ==========
    case ADD_NOTE:
    case REMOVE_NOTE: {
      if (!diffState?.user?.bible?.notes) break

      await handleSyncWithRetry(
        async () => {
          await syncSubcollectionChanges(
            userId,
            'notes',
            diffState.user.bible.notes,
            user.bible.notes,
            deleteMarker
          )
        },
        userId,
        'notes_sync',
        state
      )
      break
    }

    // ========== LINKS SYNC (sous-collection) ==========
    case ADD_LINK:
    case UPDATE_LINK:
    case REMOVE_LINK: {
      if (!diffState?.user?.bible?.links) break

      await handleSyncWithRetry(
        async () => {
          await syncSubcollectionChanges(
            userId,
            'links',
            diffState.user.bible.links,
            user.bible.links,
            deleteMarker
          )
        },
        userId,
        'links_sync',
        state
      )

      // Si des tags ont aussi changé (via removeEntityInTags), sync les tags
      if (diffState?.user?.bible?.tags) {
        await handleSyncWithRetry(
          async () => {
            await syncSubcollectionChanges(
              userId,
              'tags',
              diffState.user.bible.tags,
              user.bible.tags,
              deleteMarker
            )
          },
          userId,
          'tags_sync_from_link',
          state
        )
      }
      break
    }

    // ========== HIGHLIGHTS SYNC (sous-collection) ==========
    case ADD_HIGHLIGHT:
    case REMOVE_HIGHLIGHT:
    case CHANGE_HIGHLIGHT_COLOR: {
      if (!diffState?.user?.bible?.highlights) break

      await handleSyncWithRetry(
        async () => {
          await syncSubcollectionChanges(
            userId,
            'highlights',
            diffState.user.bible.highlights,
            user.bible.highlights,
            deleteMarker
          )
        },
        userId,
        'highlights_sync',
        state
      )

      // Si des tags ont aussi changé (via removeEntityInTags), sync les tags
      if (diffState?.user?.bible?.tags) {
        await handleSyncWithRetry(
          async () => {
            await syncSubcollectionChanges(
              userId,
              'tags',
              diffState.user.bible.tags,
              user.bible.tags,
              deleteMarker
            )
          },
          userId,
          'tags_sync_from_highlight',
          state
        )
      }
      break
    }

    // ========== TAGS SYNC (sous-collection) ==========
    case ADD_TAG:
    case REMOVE_TAG:
    case UPDATE_TAG: {
      if (!diffState?.user?.bible?.tags) break

      await handleSyncWithRetry(
        async () => {
          await syncSubcollectionChanges(
            userId,
            'tags',
            diffState.user.bible.tags,
            user.bible.tags,
            deleteMarker
          )
        },
        userId,
        'tags_sync',
        state
      )
      break
    }

    // ========== TOGGLE TAG ENTITY (modifie tag ET entity) ==========
    case TOGGLE_TAG_ENTITY: {
      if (!diffState?.user?.bible) break

      // Sync les tags modifiés
      if (diffState.user.bible.tags) {
        await handleSyncWithRetry(
          async () => {
            await syncSubcollectionChanges(
              userId,
              'tags',
              diffState.user.bible.tags,
              user.bible.tags,
              deleteMarker
            )
          },
          userId,
          'tags_sync_toggle',
          state
        )
      }

      // Sync les entités modifiées (highlights, notes, etc.)
      for (const collection of SUBCOLLECTION_NAMES) {
        if (collection !== 'tags' && diffState.user.bible[collection]) {
          await handleSyncWithRetry(
            async () => {
              await syncSubcollectionChanges(
                userId,
                collection,
                diffState.user.bible[collection],
                user.bible[collection],
                deleteMarker
              )
            },
            userId,
            `${collection}_sync_toggle`,
            state
          )
        }
      }
      break
    }

    // ========== STUDIES SYNC (collection séparée - inchangé) ==========
    case CREATE_STUDY:
    case UPDATE_STUDY:
    case PUBLISH_STUDY: {
      if (!diffState?.user?.bible?.studies) break

      const { studies } = diffState.user.bible

      try {
        await Promise.all(
          Object.entries(studies).map(async ([studyId, obj]) => {
            const studyDocRef = doc(firebaseDb, 'studies', studyId)
            const studyContent = state.user.bible.studies[studyId]?.content?.ops

            try {
              await setDoc(
                studyDocRef,
                {
                  ...removeUndefinedVariables(obj),
                  content: { ops: studyContent || [] },
                },
                { merge: true }
              )
              console.log(`[Firestore] Study ${studyId} synced successfully`)
            } catch (studyError) {
              console.error(`Failed to sync study ${studyId}:`, studyError)
              Sentry.captureException(studyError, {
                tags: { feature: 'sync', action: 'study_sync', studyId },
                extra: { userId, studyTitle: (obj as any)?.title || 'unknown' },
              })
              throw studyError
            }
          })
        )
      } catch (studiesError) {
        console.error('Studies sync failed:', studiesError)
        toast.error(i18n.t('app.syncError'))
      }
      break
    }

    case DELETE_STUDY: {
      if (!diffState?.user?.bible?.studies) break
      const { studies } = diffState.user.bible

      try {
        await Promise.all(
          Object.entries(studies).map(async ([studyId]) => {
            const studyDocRef = doc(firebaseDb, 'studies', studyId)

            try {
              const studyDocSnap = await getDoc(studyDocRef)
              if (!studyDocSnap.exists()) {
                console.log(`[Firestore] Study ${studyId} already deleted`)
                return
              }

              await deleteDoc(studyDocRef)
              console.log(`[Firestore] Study ${studyId} deleted successfully`)
            } catch (deleteError) {
              console.error(`Failed to delete study ${studyId}:`, deleteError)
              Sentry.captureException(deleteError, {
                tags: { feature: 'sync', action: 'study_delete', studyId },
                extra: { userId },
              })
              throw deleteError
            }
          })
        )
      } catch (deletionError) {
        console.error('Studies deletion failed:', deletionError)
        toast.error(i18n.t('app.syncError'))
      }
      break
    }

    // ========== IMPORT DATA (migration vers sous-collections) ==========
    case IMPORT_DATA: {
      const { bible, studies, plan: importedPlan } = action.payload

      await handleSyncWithRetry(
        async () => {
          // 1. Migrer les données vers les sous-collections
          await migrateImportedDataToSubcollections(userId, {
            bookmarks: bible?.bookmarks,
            highlights: bible?.highlights,
            notes: bible?.notes,
            links: bible?.links,
            tags: bible?.tags,
            strongsHebreu: bible?.strongsHebreu,
            strongsGrec: bible?.strongsGrec,
            words: bible?.words,
            naves: bible?.naves,
          })

          // 2. Sync settings dans le document user
          if (bible?.settings) {
            await setDoc(
              userDocRef,
              { bible: { settings: removeUndefinedVariables(bible.settings) } },
              { merge: true }
            )
          }

          // 3. Sync plan
          if (importedPlan) {
            await setDoc(userDocRef, { plan: importedPlan }, { merge: true })
          }
        },
        userId,
        'import_data',
        state
      )

      // 4. Sync studies (collection séparée)
      if (studies && Object.keys(studies).length > 0) {
        try {
          await Promise.all(
            Object.entries(studies).map(async ([studyId, study]) => {
              await setDoc(doc(firebaseDb, 'studies', studyId), removeUndefinedVariables(study), {
                merge: true,
              })
            })
          )
          console.log('[Sync] Studies imported successfully')
        } catch (studiesError) {
          console.error('[Sync] Failed to import studies:', studiesError)
          toast.error(i18n.t('app.syncError'))
        }
      }
      break
    }

    default:
  }

  return result
}
