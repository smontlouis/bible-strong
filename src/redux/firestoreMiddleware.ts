import { getAuth } from '@react-native-firebase/auth'
import { isAnyOf, Middleware } from '@reduxjs/toolkit'
import * as Sentry from '@sentry/react-native'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import { tokenManager } from '~helpers/TokenManager'

// Import action creators from user.ts
import {
  importData,
  onUserLogout,
  resetCompareVersion,
  saveAllLogsAsSeen,
  toggleCompareVersion,
} from './modules/user'

// Import action creators from sub-modules
import {
  addBookmarkAction,
  moveBookmark,
  removeBookmark,
  updateBookmark,
} from './modules/user/bookmarks'
import { addCustomColor, deleteCustomColor, updateCustomColor } from './modules/user/customColors'
import {
  addHighlightAction,
  changeHighlightColor,
  removeHighlight,
} from './modules/user/highlights'
import { addLinkAction, deleteLink, updateLink } from './modules/user/links'
import { addNoteAction, deleteNote } from './modules/user/notes'
import {
  addWordAnnotationAction,
  changeWordAnnotationColorAction,
  changeWordAnnotationTypeAction,
  removeWordAnnotationAction,
  removeWordAnnotationsInRangeAction,
  updateWordAnnotationAction,
} from './modules/user/wordAnnotations'
import {
  changeColor,
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
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
} from './modules/user/settings'
import { deleteStudy, publishStudyAction, updateStudy } from './modules/user/studies'
import { addTag, removeTag, toggleTagEntity, updateTag } from './modules/user/tags'

import { diff } from '~helpers/deep-obj'
import { toast } from '~helpers/toast'
import { migrateImportedDataToSubcollections } from '~helpers/firestoreMigration'
import {
  batchWriteSubcollection,
  SUBCOLLECTION_NAMES,
  type BatchChanges,
  type SubcollectionName,
} from '~helpers/firestoreSubcollections'
import i18n from '~i18n'
import { RootState } from '~redux/modules/reducer'
import { deleteDoc, deleteField, doc, firebaseDb, getDoc, setDoc } from '../helpers/firebase'
import { fetchPlan, markAsRead, removePlan, resetPlan } from './modules/plan'

export const removeUndefinedVariables = (obj: any) => JSON.parse(JSON.stringify(obj)) // Remove undefined variables

/**
 * Nettoie un objet pour Firestore en supprimant les valeurs undefined/null
 * tout en préservant les sentinels Firestore (comme deleteField())
 * Retourne null (jamais undefined) pour éviter les erreurs Firestore
 */
export const cleanForFirestore = (obj: any): any => {
  if (obj === undefined) return null
  if (obj === null) return null
  if (typeof obj !== 'object') return obj

  // Préserver les sentinels Firestore (comme deleteField())
  // Les sentinels ont une propriété _methodName ou isEqual
  if (obj._methodName || typeof obj.isEqual === 'function') return obj

  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore).filter(v => v !== undefined && v !== null)
  }

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const value = cleanForFirestore(obj[key])
    if (value !== undefined && value !== null) {
      result[key] = value
    }
  }
  return Object.keys(result).length > 0 ? result : null
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

// RTK Matchers for action grouping
const isPlanAction = isAnyOf(removePlan, fetchPlan.fulfilled, resetPlan, markAsRead)

const isSettingsAction = isAnyOf(
  setSettingsAlignContent,
  setSettingsLineHeight,
  increaseSettingsFontSizeScale,
  decreaseSettingsFontSizeScale,
  setSettingsTextDisplay,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
  setSettingsPreferredColorScheme,
  setSettingsPress,
  setSettingsNotesDisplay,
  setSettingsLinksDisplay,
  setSettingsTagsDisplay,
  setSettingsCommentaires,
  changeColor,
  toggleCompareVersion,
  resetCompareVersion,
  toggleSettingsShareAppName,
  toggleSettingsShareLineBreaks,
  toggleSettingsShareQuotes,
  toggleSettingsShareVerseNumbers,
  saveAllLogsAsSeen,
  setDefaultColorName,
  setDefaultColorType
)

const isCustomColorAction = isAnyOf(addCustomColor, updateCustomColor, deleteCustomColor)

const isBookmarkAction = isAnyOf(addBookmarkAction, removeBookmark, updateBookmark, moveBookmark)

const isNoteAction = isAnyOf(addNoteAction, deleteNote)

const isLinkAction = isAnyOf(addLinkAction, updateLink, deleteLink)

const isHighlightAction = isAnyOf(addHighlightAction, removeHighlight, changeHighlightColor)

const isWordAnnotationAction = isAnyOf(
  addWordAnnotationAction,
  updateWordAnnotationAction,
  removeWordAnnotationAction,
  removeWordAnnotationsInRangeAction,
  changeWordAnnotationColorAction,
  changeWordAnnotationTypeAction
)

const isTagAction = isAnyOf(addTag, removeTag, updateTag)

const isStudyUpdateAction = isAnyOf(updateStudy, publishStudyAction)

const firestoreMiddleware: Middleware = store => next => async action => {
  const oldState = store.getState()
  const result = next(action)

  // Early return for logout - prevent race conditions with app lifecycle
  if (onUserLogout.match(action)) {
    return result
  }

  const state = store.getState() as RootState

  const deleteMarker = deleteField()
  const diffState: any = diff(oldState, state, deleteMarker)

  // FIX BUG #1: Vérifier Firebase Auth au lieu de Redux user.id
  const currentUser = getAuth().currentUser

  if (!currentUser || !state.user.id) {
    // Pas d'utilisateur Firebase Auth authentifié
    return result
  }

  const userId = currentUser.uid
  const { user, plan } = state
  const userDocRef = doc(firebaseDb, 'users', userId)

  // Schedule un backup automatique après chaque changement (debounced 30s)
  autoBackupManager.scheduleBackup(state)

  // ========== PLAN SYNC ==========
  if (isPlanAction(action)) {
    try {
      await setDoc(
        userDocRef,
        { plan: removeUndefinedVariables(plan.ongoingPlans) },
        { merge: true }
      )
    } catch (error) {
      console.log('[Firestore] Error syncing plan:', error)
      toast.error(i18n.t('app.syncError'))
      Sentry.captureException(error, {
        tags: { feature: 'sync', action: 'plan_sync' },
        extra: { userId },
      })
    }
    return result
  }

  // ========== SETTINGS SYNC (reste dans le document user) ==========
  if (isSettingsAction(action)) {
    if (!diffState?.user?.bible?.settings) return result

    const cleanedSettings = cleanForFirestore(diffState.user.bible.settings)

    // Ne pas sync si le résultat est vide/null (évite les erreurs Firestore)
    if (!cleanedSettings) return result

    await handleSyncWithRetry(
      async () => {
        await setDoc(userDocRef, { bible: { settings: cleanedSettings } }, { merge: true })
      },
      userId,
      'settings_sync',
      state
    )
    return result
  }

  // ========== CUSTOM HIGHLIGHT COLORS SYNC ==========
  if (isCustomColorAction(action)) {
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
    return result
  }

  // ========== BOOKMARKS SYNC (sous-collection) ==========
  if (isBookmarkAction(action)) {
    if (!diffState?.user?.bible?.bookmarks) return result

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
    return result
  }

  // ========== NOTES SYNC (sous-collection) ==========
  if (isNoteAction(action)) {
    if (!diffState?.user?.bible?.notes) return result

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
    return result
  }

  // ========== LINKS SYNC (sous-collection) ==========
  if (isLinkAction(action)) {
    if (!diffState?.user?.bible?.links) return result

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
    return result
  }

  // ========== HIGHLIGHTS SYNC (sous-collection) ==========
  if (isHighlightAction(action)) {
    if (!diffState?.user?.bible?.highlights) return result

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
    return result
  }

  // ========== WORD ANNOTATIONS SYNC (sous-collection) ==========
  if (isWordAnnotationAction(action)) {
    if (!diffState?.user?.bible?.wordAnnotations) return result

    await handleSyncWithRetry(
      async () => {
        await syncSubcollectionChanges(
          userId,
          'wordAnnotations',
          diffState.user.bible.wordAnnotations,
          user.bible.wordAnnotations,
          deleteMarker
        )
      },
      userId,
      'word_annotations_sync',
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
        'tags_sync_from_word_annotation',
        state
      )
    }

    // Si des notes ont aussi changé (cascade delete from annotation), sync les notes
    if (diffState?.user?.bible?.notes) {
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
        'notes_sync_from_word_annotation',
        state
      )
    }
    return result
  }

  // ========== TAGS SYNC (sous-collection) ==========
  if (isTagAction(action)) {
    if (!diffState?.user?.bible?.tags) return result

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
    return result
  }

  // ========== TOGGLE TAG ENTITY (modifie tag ET entity) ==========
  if (toggleTagEntity.match(action)) {
    if (!diffState?.user?.bible) return result

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
    return result
  }

  // ========== STUDIES SYNC (collection séparée) ==========
  if (isStudyUpdateAction(action)) {
    if (!diffState?.user?.bible?.studies) return result

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
    return result
  }

  if (deleteStudy.match(action)) {
    if (!diffState?.user?.bible?.studies) return result
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
    return result
  }

  // ========== IMPORT DATA (migration vers sous-collections) ==========
  if (importData.match(action)) {
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
          await setDoc(
            userDocRef,
            { plan: removeUndefinedVariables(importedPlan) },
            { merge: true }
          )
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
    return result
  }

  return result
}

export default firestoreMiddleware
