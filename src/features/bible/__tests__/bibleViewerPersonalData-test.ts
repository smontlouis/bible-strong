import {
  getBibleViewerPersonalData,
  shouldHideBibleViewerPersonalData,
} from '../bibleViewerPersonalData'
import {
  ANNOTATION_SELECTED,
  CREATE_ANNOTATION,
  ENTER_ANNOTATION_MODE,
  ERASE_SELECTION,
  NAVIGATE_TO_BIBLE_LINK,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_RELATION_ENDPOINT,
  NAVIGATE_TO_TAG,
  NAVIGATE_TO_VERSE_LINKS,
  NAVIGATE_TO_VERSE_STUDY_RELATIONS,
  OPEN_BOOKMARK_MODAL,
  OPEN_CANONICAL_BIBLE_NOTE,
  OPEN_CROSS_VERSION_MODAL,
  OPEN_HIGHLIGHT_TAGS,
  OPEN_ANNOTATION_TAGS,
  OPEN_STRONG_SELECTION,
  OPEN_VERSE_TAGS_MODAL,
  SELECTION_CHANGED,
  TOGGLE_SELECTED_VERSE,
  isPersonalBibleDataAction,
} from '../BibleDOM/dispatch'

describe('Bible viewer personal data policy', () => {
  it.each(['visible', 'interlinear', 'strong', 'transliteration'] as const)(
    'hides personal data in the advanced BHG %s mode',
    interlinearMode => {
      expect(
        shouldHideBibleViewerPersonalData({
          version: 'BHG',
          interlinearMode,
          strongMode: 'hidden',
        })
      ).toBe(true)
    }
  )

  it('hides personal Bible data in reverse interlinear mode for a Strong Bible', () => {
    expect(
      shouldHideBibleViewerPersonalData({
        version: 'DBY',
        interlinearMode: undefined,
        strongMode: 'reverse-interlinear',
      })
    ).toBe(true)
  })

  it('keeps personal Bible data in normal text and visible Strong modes', () => {
    expect(
      shouldHideBibleViewerPersonalData({
        version: 'BHG',
        interlinearMode: 'hidden',
        strongMode: 'hidden',
      })
    ).toBe(false)
    expect(
      shouldHideBibleViewerPersonalData({
        version: 'DBY',
        interlinearMode: undefined,
        strongMode: 'visible',
      })
    ).toBe(false)
  })

  it('removes every personal viewer decoration when the policy is active', () => {
    const content = {
      isSelectionMode: 'verse' as const,
      selectedVerses: { '1-1-1': true as const },
      highlightedVerses: { '1-1-1': { color: 'color1', date: 1 } },
      notedVerses: { note: { id: 'note', title: 'Note', description: '', date: 1 } },
      allNotes: { note: { id: 'note', title: 'Note', description: '', date: 1 } },
      bookmarkedVerses: {
        1: {
          id: 'bookmark',
          name: 'Bookmark',
          color: 'color1',
          book: 1,
          chapter: 1,
          date: 1,
        },
      },
      linkedVerses: {
        '1-1-1': { id: 'link', url: 'https://example.com', linkType: 'website' as const, date: 1 },
      },
      allLinks: {
        '1-1-1': { id: 'link', url: 'https://example.com', linkType: 'website' as const, date: 1 },
      },
      studyRelations: {},
      wordAnnotations: {
        annotation: {
          id: 'annotation',
          version: 'LSG' as const,
          ranges: [{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Au' }],
          color: 'color1',
          type: 'background' as const,
          date: 1,
        },
      },
      annotationMode: true,
      wordAnnotationsInOtherVersions: { '1-1-1': [{ version: 'LSG' as const, count: 1 }] },
      taggedVersesInChapter: { 1: 2 },
      versesWithNonHighlightTags: { 1: true },
    }

    expect(getBibleViewerPersonalData(true, content)).toEqual({
      isSelectionMode: undefined,
      selectedVerses: {},
      highlightedVerses: {},
      notedVerses: {},
      allNotes: {},
      bookmarkedVerses: {},
      linkedVerses: {},
      allLinks: {},
      studyRelations: {},
      wordAnnotations: {},
      annotationMode: false,
      wordAnnotationsInOtherVersions: {},
      taggedVersesInChapter: {},
      versesWithNonHighlightTags: {},
    })
    expect(getBibleViewerPersonalData(false, content)).toBe(content)
  })

  it.each([
    NAVIGATE_TO_BIBLE_NOTE,
    NAVIGATE_TO_BIBLE_LINK,
    NAVIGATE_TO_RELATION_ENDPOINT,
    NAVIGATE_TO_VERSE_LINKS,
    NAVIGATE_TO_VERSE_STUDY_RELATIONS,
    TOGGLE_SELECTED_VERSE,
    OPEN_HIGHLIGHT_TAGS,
    OPEN_ANNOTATION_TAGS,
    OPEN_BOOKMARK_MODAL,
    NAVIGATE_TO_TAG,
    ENTER_ANNOTATION_MODE,
    SELECTION_CHANGED,
    CREATE_ANNOTATION,
    ERASE_SELECTION,
    ANNOTATION_SELECTED,
    OPEN_CROSS_VERSION_MODAL,
    OPEN_VERSE_TAGS_MODAL,
  ])('classifies %s as a personal Bible data action', actionType => {
    expect(isPersonalBibleDataAction(actionType)).toBe(true)
  })

  it.each([OPEN_STRONG_SELECTION, OPEN_CANONICAL_BIBLE_NOTE, NAVIGATE_TO_PERICOPE])(
    'keeps %s available in interlinear reading modes',
    actionType => {
      expect(isPersonalBibleDataAction(actionType)).toBe(false)
    }
  )
})
