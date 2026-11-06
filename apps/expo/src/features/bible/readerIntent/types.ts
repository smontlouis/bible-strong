/**
 * Reader intents (ADR-0098): what the Bible reader page asks of the study workspace. The page
 * imports this file for its types only; `handleReaderIntent` decodes and handles each intent.
 */
import type { RelationEndpoint } from '~features/studyRelations/domain'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import type { StrongIdentity } from '~helpers/strongIdentities'
import type { StrongSelectionMorphology } from '~helpers/strongSelection'

/** Reading: the chapter, the controls, the plan day, the versions and modes of the columns. */
export type ReadingIntent =
  | { kind: 'next-chapter' }
  | { kind: 'previous-chapter' }
  | { kind: 'hide-controls' }
  | { kind: 'show-controls' }
  | { kind: 'plan-day-step' }
  /** Column 0 is the main version, n the n-th parallel version. */
  | { kind: 'choose-column-version'; column: number }
  | { kind: 'open-column-text-mode'; mode: 'strong' | 'interlinear'; column: number }

/** Where the reader touched what it opens. */
export type OpenOrigin =
  /** A word, or a note mark, of the text. */
  | 'text'
  /** An item of a Relation, beside a verse or under a Word annotation. */
  | 'relation'
  /** A tag of a verse or of a Word annotation. */
  | 'tag'
  /** A section heading of the chapter. */
  | 'heading'
  /** The verse itself: a tap or a long press on it. */
  | 'verse'
  /** The entities of the chapter. */
  | 'chapter-entities'
  /** The study of a verse in focus. */
  | 'focus-study'
  /** A commentary shown within the text. */
  | 'inline-commentary'
  /** The media of the passage, in their overlay. */
  | 'passage-media'

/** The Relation an object is opened from: its fallbacks need it. */
export type OpenedRelation = {
  /** The endpoint the reader stands on: the verse, or the Word annotation. */
  activeEndpoint?: RelationEndpoint
  /** The verses of that endpoint. */
  verseIds: string[]
  /** The other endpoint still exists among the study data of the user. */
  targetExists: boolean
}

/** What the reader opens: a Relation endpoint whenever one describes it, a target of its own otherwise. */
export type OpenTarget =
  | { kind: 'endpoint'; endpoint: RelationEndpoint; relation?: OpenedRelation }
  /** The Strong entries of a word of the text, with what the text tells of them. */
  | {
      kind: 'strong-word'
      identities: StrongIdentity[]
      morphologies?: StrongSelectionMorphology[]
      word?: string
      occurrenceId?: string
    }
  | { kind: 'biblical-entity'; entityKey: string }
  /** The places of the chapter on the map, by unique name. */
  | { kind: 'map'; places: string[] }
  | { kind: 'tag'; tagId: string }
  /** The index of the pericopes of the book. */
  | { kind: 'pericopes' }
  | {
      kind: 'commentary-section'
      resourceId: string
      language: string
      revision: string
      sectionId: string
    }
  /** A note of the Bible version's own text. */
  | { kind: 'canonical-note'; note: CanonicalBibleNote }
  /** The page a passage media comes from. */
  | { kind: 'media-source'; url: string }
  /** A resource of the verse touched, in its sheet. */
  | { kind: 'verse-resource'; resource: 'strong' }

/** Open: a study object, and where the reader touched it. */
export type OpenIntent = {
  kind: 'open'
  target: OpenTarget
  origin: OpenOrigin
  /** The verse touched, as `book-chapter-verse`. */
  verseKey?: string
  /** The Bible version of the column touched. */
  version?: string
}

/** Select: the Selected verses of the reader, in one Bible version. */
export type SelectIntent =
  /** A verse tapped is selected, or unselected, in the version of the column it was tapped in. */
  | { kind: 'toggle-selected-verse'; verseKey: string; version?: string }
  /** A tap away from the text. */
  | { kind: 'clear-selected-verses' }

/** A word of a verse, by its index among the words of the verse text. */
export type WordPosition = { verseKey: string; wordIndex: number }

/** The words selected in annotation mode, in one Bible version. */
export type WordSelection = { start: WordPosition; end: WordPosition; version?: string }

/** The words of one verse a Word annotation marks: the text is the module's to read. */
export type WordRange = { verseKey: string; startWordIndex: number; endWordIndex: number }

export type WordAnnotationType = 'background' | 'underline' | 'circle'

/** Annotate: Word annotations, in the version of the column the words were touched in. */
export type AnnotateIntent =
  /** A double tap on a verse, or a handle of selected verses dragged: the words take over. */
  | { kind: 'enter-annotation-mode'; version?: string; verseKey?: string }
  | { kind: 'exit-annotation-mode' }
  /** The words selected changed, or none is selected any more. */
  | { kind: 'change-word-selection'; selection: WordSelection | null }
  | {
      kind: 'create-word-annotation'
      ranges: WordRange[]
      color: string
      type: WordAnnotationType
      version?: string
    }
  /** The Word annotations over the words from `start` to `end` are erased. */
  | { kind: 'erase-word-annotations'; start: WordPosition; end: WordPosition; version?: string }
  /** A Word annotation is picked, or none. */
  | { kind: 'select-word-annotation'; annotationId: string | null }

/** Personal sheets: the sheets of the reader's own data on a verse or a Word annotation. */
export type PersonalSheetIntent =
  /** The tags of highlighted verses. */
  | { kind: 'open-highlight-tags'; verseIds: string[] }
  /** The tags of a Word annotation. */
  | { kind: 'open-annotation-tags'; annotationId: string }
  /** The tags of everything the reader keeps on a verse. */
  | { kind: 'open-verse-tags'; verseKey: string }
  | { kind: 'open-bookmark'; bookmarkId: string }
  /** The Word annotations of a verse in the Bible versions that are not on screen. */
  | { kind: 'open-cross-version-annotations'; verseKey: string }
  /** The Relations of a verse. */
  | { kind: 'open-verse-relations'; verseKey: string }

export type ReaderIntent =
  | ReadingIntent
  | OpenIntent
  | SelectIntent
  | AnnotateIntent
  | PersonalSheetIntent

/** What the page sends: an intent stamped with the Tab the page shows. */
export type ReaderIntentMessage = { tabId: string; intent: ReaderIntent }

/** The rule that refused an intent. */
export type ReaderRule =
  /** The intent was sent for a Tab that is no longer on screen (Android shares the page). */
  | 'stale-tab'
  /** A focus keeps its chapter. */
  | 'focus'
  /** Annotation mode keeps its chapter. */
  | 'annotation-mode'
  /** Plan mode keeps the reader within its passage. */
  | 'plan-passage'
  /** The version holds no chapter further that way. */
  | 'no-chapter'
  /** A form sheet keeps its controls. */
  | 'form-sheet'
  /** A wide screen keeps its controls visible. */
  | 'controls-kept-visible'
  /** The passage leads to no next element of a plan day. */
  | 'no-plan-day-step'
  /**
   * The reader hides personal Bible data (ADR-0030): notes, links, Relations, tags, bookmarks and
   * Word annotations stay shut, and no verse is selected.
   */
  | 'personal-data'
  /** The version named is shown only in interlinear presentations: it holds no personal Bible data. */
  | 'interlinear-column'
  /**
   * The words named are not in the verse text the reader holds for that version: no Word
   * annotation is saved without the words it marks.
   */
  | 'words-not-on-screen'
  /** The reader leaves for no source of a passage media but YouTube. */
  | 'unknown-media-source'

export type ReaderOutcome =
  | { status: 'done' }
  | { status: 'refused'; rule: ReaderRule }
  /** The message is not a Reader intent. */
  | { status: 'rejected' }
  /** The intent was accepted, then an effect failed. */
  | { status: 'failed' }

export type ReaderIntentHandler = (message: ReaderIntentMessage) => Promise<ReaderOutcome>
