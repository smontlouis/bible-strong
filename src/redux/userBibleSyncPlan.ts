import type { SubcollectionName } from '~helpers/firestoreSubcollections'

export type BibleSyncCollection = Exclude<SubcollectionName, 'tabGroups'>

export type BibleSyncDiff = Partial<Record<BibleSyncCollection, unknown>>

export type UserBibleSyncOperation =
  | {
      type: 'subcollection'
      collection: BibleSyncCollection
      actionName: string
    }
  | {
      type: 'relations'
      actionName: string
    }

export type UserBibleSyncOperationGroup = {
  actionName: string
  operations: UserBibleSyncOperation[]
}

export const groupUserBibleSyncOperations = (
  operations: UserBibleSyncOperation[]
): UserBibleSyncOperationGroup[] => {
  const groups: UserBibleSyncOperationGroup[] = []

  operations.forEach(operation => {
    const existing = groups.find(group => group.actionName === operation.actionName)
    if (existing) {
      existing.operations.push(operation)
    } else {
      groups.push({ actionName: operation.actionName, operations: [operation] })
    }
  })

  return groups
}

export const planNoteSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.notes) return []

  return [
    { type: 'subcollection', collection: 'notes', actionName: 'notes_sync' },
    { type: 'relations', actionName: 'notes_sync' },
  ]
}

export const planBookmarkSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.bookmarks) return []

  return [{ type: 'subcollection', collection: 'bookmarks', actionName: 'bookmarks_sync' }]
}

export const planStudyRelationSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.relations) return []

  return [{ type: 'relations', actionName: 'relations_sync' }]
}

export const planTagSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.tags) return []

  return [{ type: 'subcollection', collection: 'tags', actionName: 'tags_sync' }]
}

export const planLinkSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.links) return []

  return [
    { type: 'subcollection', collection: 'links', actionName: 'links_sync' },
    { type: 'relations', actionName: 'links_sync' },
    ...(diffBible.tags
      ? [
          {
            type: 'subcollection' as const,
            collection: 'tags' as const,
            actionName: 'tags_sync_from_link',
          },
        ]
      : []),
  ]
}

export const planHighlightSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.highlights) return []

  return [
    { type: 'subcollection', collection: 'highlights', actionName: 'highlights_sync' },
    ...(diffBible.tags
      ? [
          {
            type: 'subcollection' as const,
            collection: 'tags' as const,
            actionName: 'tags_sync_from_highlight',
          },
        ]
      : []),
  ]
}

export const planWordAnnotationSync = (diffBible: BibleSyncDiff): UserBibleSyncOperation[] => {
  if (!diffBible.wordAnnotations) return []

  return [
    {
      type: 'subcollection',
      collection: 'wordAnnotations',
      actionName: 'word_annotations_sync',
    },
    ...(diffBible.tags
      ? [
          {
            type: 'subcollection' as const,
            collection: 'tags' as const,
            actionName: 'tags_sync_from_word_annotation',
          },
        ]
      : []),
    ...(diffBible.notes
      ? [
          {
            type: 'subcollection' as const,
            collection: 'notes' as const,
            actionName: 'notes_sync_from_word_annotation',
          },
        ]
      : []),
    ...(diffBible.relations
      ? [{ type: 'relations' as const, actionName: 'relations_sync_from_word_annotation' }]
      : []),
  ]
}

export const planToggleTagEntitySync = (
  diffBible: BibleSyncDiff,
  subcollections: SubcollectionName[]
): UserBibleSyncOperation[] => {
  const operations: UserBibleSyncOperation[] = []

  if (diffBible.tags) {
    operations.push({
      type: 'subcollection',
      collection: 'tags',
      actionName: 'tags_sync_toggle',
    })
  }

  subcollections.forEach(collection => {
    if (collection === 'tags' || collection === 'tabGroups') return
    const bibleCollection = collection as BibleSyncCollection
    if (diffBible[bibleCollection]) {
      operations.push({
        type: 'subcollection',
        collection: bibleCollection,
        actionName: `${collection}_sync_toggle`,
      })
    }
  })

  return operations
}
