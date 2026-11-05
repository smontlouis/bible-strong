/**
 * Reader intents (ADR-0098): what the Bible reader page asks of the study workspace. The page
 * imports this file for its types only; `handleReaderIntent` decodes and handles each intent.
 */

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

export type ReaderIntent = ReadingIntent

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

export type ReaderOutcome =
  | { status: 'done' }
  | { status: 'refused'; rule: ReaderRule }
  /** The message is not a Reader intent. */
  | { status: 'rejected' }
  /** The intent was accepted, then an effect failed. */
  | { status: 'failed' }

export type ReaderIntentHandler = (message: ReaderIntentMessage) => Promise<ReaderOutcome>
