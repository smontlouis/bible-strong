import type { VerseRelationItem } from './BibleDOMWrapper'
import {
  NAVIGATE_TO_BIBLE_LINK,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_RELATION_ENDPOINT,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  SHOW_TOAST,
} from './dispatch'

export type RelationDisplayAction = {
  type: string
  payload?: unknown
}

export const getVerseStudyRelationsPayload = (
  verseKey: string,
  relationItem?: VerseRelationItem
) =>
  relationItem
    ? {
        verseKey,
        verseIds: relationItem.verseIds,
        relationId: relationItem.relationId,
      }
    : verseKey

export const getRelationItemNavigationActions = (
  verseKey: string,
  item: VerseRelationItem
): RelationDisplayAction[] => {
  switch (item.targetEndpoint.type) {
    case 'note':
      if (!item.targetEntityExists) {
        return [
          {
            type: SHOW_TOAST,
            payload: {
              type: 'warning',
              message: "Cette note n'existe plus. Vous pouvez supprimer la relation.",
            },
          },
          {
            type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
            payload: getVerseStudyRelationsPayload(verseKey, item),
          },
        ]
      }

      return [
        {
          type: NAVIGATE_TO_BIBLE_NOTE,
          payload: {
            noteId: item.targetEndpoint.noteId,
            verseIds: item.verseIds,
          },
        },
      ]
    case 'externalLink':
      if (item.targetEntityExists && item.targetEndpoint.linkId) {
        return [{ type: NAVIGATE_TO_BIBLE_LINK, payload: item.targetEndpoint.linkId }]
      }

      if (item.targetIsAvailable) {
        return [{ type: NAVIGATE_TO_RELATION_ENDPOINT, payload: item.targetEndpoint }]
      }

      return [
        {
          type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
          payload: getVerseStudyRelationsPayload(verseKey, item),
        },
      ]
    default:
      if (!item.targetIsAvailable) {
        return [
          {
            type: NAVIGATE_TO_VERSE_STUDY_RELATIONS,
            payload: getVerseStudyRelationsPayload(verseKey, item),
          },
        ]
      }

      return [{ type: NAVIGATE_TO_RELATION_ENDPOINT, payload: item.targetEndpoint }]
  }
}
