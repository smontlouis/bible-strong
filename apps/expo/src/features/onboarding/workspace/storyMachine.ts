import {
  digitOf,
  findShortcut,
  type ShortcutEvent,
  type ShortcutId,
} from '~features/keyboard-shortcuts/keymap'

/**
 * The story of the Web and the desktop app: the mobile story of Abel (Genesis 4:2), told on
 * one board that fills up, where each gesture is the app's own key. The reader selects the
 * verse and highlights it, opens its lexicon, meets hevel behind the name, follows the word,
 * writes a note, relates it, then goes back to the verse.
 */
export const STORY_STEPS = [
  'highlight',
  'tools',
  'strong',
  'occurrences',
  'note',
  'relations',
  'return',
] as const
/**
 * The story with Strobi's step, when Remote Config opens the assistant: after the word has
 * crossed the Bible, the reader asks Strobi about it.
 */
export const STORY_STEPS_WITH_STROBI = [
  'highlight',
  'tools',
  'strong',
  'occurrences',
  'strobi',
  'note',
  'relations',
  'return',
] as const
type StoryStepName = (typeof STORY_STEPS_WITH_STROBI)[number]
export type StoryStep = StoryStepName | 'finish'

/** Where Strobi's step is: the question waits, Strobi thinks, answers, then the reader accepts. */
export type StrobiPhase = 'question' | 'thinking' | 'answer' | 'accepted'

export const HIGHLIGHT_COLORS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
export type StoryHighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/** The study tools of a selection, in the order of the verse menu, each with its key. */
export const STORY_TOOLS = [
  'lexicon',
  'dictionary',
  'topics',
  'references',
  'commentary',
  'compare',
] as const satisfies readonly ShortcutId[]
export type StoryTool = (typeof STORY_TOOLS)[number]

/** The three ways the reader draws a highlight (`HighlightType` of the app). */
export const HIGHLIGHT_TYPES = ['background', 'textColor', 'underline'] as const
export type StoryHighlightType = (typeof HIGHLIGHT_TYPES)[number]

export type StoryWord = 'proper' | 'common'
export const OCCURRENCE_FILTERS = ['vanity', 'idol', 'breath'] as const
export type OccurrenceFilter = (typeof OCCURRENCE_FILTERS)[number]

export type StoryState = {
  step: StoryStep
  /** The steps of this telling, with or without Strobi's. */
  steps: readonly StoryStepName[]
  strobi: StrobiPhase
  selected: boolean
  color?: StoryHighlightColor
  highlightType: StoryHighlightType
  tool?: StoryTool
  word: StoryWord
  filter: OccurrenceFilter
  noted: boolean
  tagged: boolean
  related: boolean
  returned: boolean
  /** The key the reader should press, after a key that cannot act yet; counts each reminder. */
  nudge?: { key: ShortcutId; count: number }
}

export const initialStoryState: StoryState = {
  step: 'highlight',
  steps: STORY_STEPS,
  strobi: 'question',
  selected: false,
  highlightType: 'background',
  word: 'proper',
  filter: 'vanity',
  noted: false,
  tagged: false,
  related: false,
  returned: false,
}

export type StoryAction =
  | { type: 'shortcut'; id: ShortcutId; digit?: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'highlightType'; value: StoryHighlightType }
  | { type: 'word'; word: StoryWord }
  | { type: 'filter'; filter: OccurrenceFilter }
  | { type: 'finish' }
  /** Remote Config's answer, heard until the first step is left. */
  | { type: 'steps'; withStrobi: boolean }
  | { type: 'askStrobi' }
  | { type: 'strobiAnswered' }
  | { type: 'tryStrobi' }

/** The keys the story listens to: the reader's keys of the Bible and of a selection. */
export const STORY_SHORTCUTS = [
  'nextVerse',
  'previousVerse',
  'highlight',
  'removeHighlight',
  ...STORY_TOOLS,
  'note',
  'tags',
  'relation',
  'deselect',
] as const satisfies readonly ShortcutId[]

/** What a key press means to the story, read through the app's own keymap. */
export function storyActionForKey(event: ShortcutEvent, mac?: boolean): StoryAction | undefined {
  if (
    event.key === 'Enter' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.isComposing
  )
    return event.shiftKey ? { type: 'back' } : { type: 'next' }
  const id = findShortcut(event, STORY_SHORTCUTS, mac)
  if (!id) return undefined
  return id === 'highlight'
    ? { type: 'shortcut', id, digit: digitOf(event) }
    : { type: 'shortcut', id }
}

/** The keys a step asks for, in the order its instruction names them. */
export function stepKeys(state: StoryState): ShortcutId[] {
  switch (state.step) {
    case 'highlight':
      return state.selected ? ['highlight'] : ['nextVerse']
    case 'tools':
      return ['lexicon']
    case 'note':
      return ['note']
    case 'relations':
      return ['relation']
    case 'return':
      return ['deselect']
    default:
      return []
  }
}

/**
 * What Continue does for a reader who has not pressed the step's key: the step's own gesture,
 * done the default way, so the story never stops and the board still fills up. The verse takes
 * the first colour, the lexicon opens, the note is written, the relations drawn, and the reader
 * goes back to the verse.
 */
export function completeStep(state: StoryState): StoryState {
  switch (state.step) {
    case 'highlight':
      return { ...state, selected: true, color: state.color ?? HIGHLIGHT_COLORS[0] }
    case 'tools':
      return { ...state, tool: 'lexicon' }
    case 'note':
      return { ...state, noted: true }
    case 'relations':
      return { ...state, related: true }
    case 'return':
      return { ...state, returned: true }
    default:
      return state
  }
}

const nudge = (state: StoryState): StoryState => {
  const [key] = stepKeys(state)
  return key ? { ...state, nudge: { key, count: (state.nudge?.count ?? 0) + 1 } } : state
}

const goTo = (state: StoryState, step: StoryStep): StoryState => ({
  ...state,
  step,
  nudge: undefined,
})

const stepIndex = (steps: readonly StoryStepName[], step: StoryStep) =>
  steps.indexOf(step as StoryStepName)

function onShortcut(
  state: StoryState,
  action: Extract<StoryAction, { type: 'shortcut' }>
): StoryState {
  const { id } = action
  switch (state.step) {
    case 'highlight': {
      if (id === 'nextVerse' || id === 'previousVerse') return { ...state, selected: true }
      if (id === 'deselect') return { ...state, selected: false }
      if (!state.selected) return nudge(state)
      if (id === 'highlight') {
        const color = HIGHLIGHT_COLORS[(action.digit ?? 1) - 1]
        return color ? { ...state, color, nudge: undefined } : state
      }
      if (id === 'removeHighlight') return { ...state, color: undefined }
      return state
    }
    case 'tools':
      if ((STORY_TOOLS as readonly ShortcutId[]).includes(id)) {
        const tool = id as StoryTool
        // The lexicon is the door the story takes: it opens on the word behind « Abel ».
        return tool === 'lexicon' ? { ...goTo(state, 'strong'), tool } : { ...state, tool }
      }
      return nudge(state)
    case 'note':
      if (id === 'note') return { ...state, noted: true, nudge: undefined }
      if (id === 'tags') return state.noted ? { ...state, tagged: true } : nudge(state)
      return nudge(state)
    case 'relations':
      return id === 'relation' ? { ...state, related: true, nudge: undefined } : nudge(state)
    case 'return':
      return id === 'deselect' ? { ...state, returned: true, nudge: undefined } : nudge(state)
    default:
      return state
  }
}

export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'shortcut':
      return onShortcut(state, action)
    case 'next': {
      if (state.step === 'finish') return state
      // Strobi's step asks first: Continue puts the question, then waits for the answer.
      if (state.step === 'strobi' && state.strobi === 'question')
        return { ...state, strobi: 'thinking' }
      if (state.step === 'strobi' && state.strobi === 'thinking') return state
      const next = state.steps[stepIndex(state.steps, state.step) + 1]
      return goTo(completeStep(state), next ?? 'finish')
    }
    case 'back': {
      if (state.step === 'finish') return goTo({ ...state, returned: false }, 'return')
      const previous = state.steps[stepIndex(state.steps, state.step) - 1]
      if (!previous) return state
      // Going back undoes what the step being left did, so its key teaches again.
      if (state.step === 'strong') return { ...goTo(state, previous), tool: undefined }
      if (state.step === 'return') return { ...goTo(state, previous), returned: false }
      return goTo(state, previous)
    }
    case 'highlightType':
      return state.step === 'highlight' && state.color
        ? { ...state, highlightType: action.value }
        : state
    case 'word':
      return state.step === 'strong' ? { ...state, word: action.word } : state
    case 'filter':
      return state.step === 'occurrences' ? { ...state, filter: action.filter } : state
    case 'finish':
      return goTo(state, 'finish')
    case 'steps':
      return state.step === 'highlight'
        ? { ...state, steps: action.withStrobi ? STORY_STEPS_WITH_STROBI : STORY_STEPS }
        : state
    case 'askStrobi':
      return state.step === 'strobi' && state.strobi === 'question'
        ? { ...state, strobi: 'thinking' }
        : state
    case 'strobiAnswered':
      return state.strobi === 'thinking' ? { ...state, strobi: 'answer' } : state
    case 'tryStrobi':
      return state.step === 'strobi' && state.strobi === 'answer'
        ? { ...state, strobi: 'accepted' }
        : state
  }
}

/** Position of the step for the progress bar, from 1: the end counts as the last. */
export const storyStepNumber = (step: StoryStep, steps: readonly StoryStepName[] = STORY_STEPS) =>
  step === 'finish' ? steps.length : stepIndex(steps, step) + 1
