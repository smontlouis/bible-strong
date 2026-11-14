import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai/react'
import { useSelector } from 'react-redux'
import type { AvatarHandle } from '@bible-strong/avatar-react-native'

import BrandMark from '~common/ui/BrandMark'
import { IS_DESKTOP } from '~desktop/isDesktopBuild'
import { useWindowControlsInset, sidebarDragRegion } from '~features/app-switcher/windowChrome'
import { isEditingTarget } from '~features/keyboard-shortcuts/keyboardTargets'
import SelectResources from '~features/onboarding/SelectResources'
import { strobiTrialRequestedAtom } from '~features/onboarding/atom'
import { assistantAvailable } from '~features/study-assistant/assistantConfig'
import { useAssistantOpening } from '~helpers/assistantOpening'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import type { RootState } from '~redux/modules/reducer'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { webFontFamily } from '~helpers/webFontFamily'
import { webThemeVariables } from '~themes/webThemeVariables'

import { Keycap, keysOf, withKeys } from './Keycap.web'
import { StoryBoard } from './StoryBoard.web'
import {
  initialStoryState,
  storyActionForKey,
  storyReducer,
  storyStepNumber,
  type StoryAction,
  type StoryState,
} from './storyMachine'
import { trackOnboarding } from './trackOnboarding'
import './workspace-onboarding.css'

export type StoryEnd = 'signIn' | 'offline' | 'continue' | 'skip'

const COLOR_PROMPTS = {
  color1: 'onboarding.abel.sceneOne.phrase',
  color2: 'onboarding.abel.sceneOne.colorPrompt.color2',
  color3: 'onboarding.abel.sceneOne.colorPrompt.color3',
  color4: 'onboarding.abel.sceneOne.colorPrompt.color4',
  color5: 'onboarding.abel.sceneOne.colorPrompt.color5',
} as const

/** The large sentence of each step: the mobile story's own. */
function phraseKey(state: StoryState, signedIn: boolean) {
  switch (state.step) {
    case 'highlight':
      return state.color ? COLOR_PROMPTS[state.color] : 'onboarding.abel.sceneOne.phrase'
    case 'tools':
      return 'onboarding.abel.sceneTwo.phrase'
    case 'strong':
      return state.word === 'proper'
        ? 'onboarding.abel.sceneThree.properPhrase'
        : 'onboarding.abel.sceneThree.commonPhrase'
    case 'occurrences':
      return 'onboarding.abel.sceneFour.phrase'
    case 'strobi':
      return 'onboarding.abel.sceneStrobi.phrase'
    case 'note':
      return 'onboarding.abel.sceneFive.phrase'
    case 'relations':
      return 'onboarding.abel.sceneSix.phrase'
    case 'return':
      return 'onboarding.abel.sceneSeven.phrase'
    case 'finish':
      return signedIn
        ? 'workspaceOnboarding.finish.titleSignedIn'
        : 'workspaceOnboarding.finish.title'
  }
}

/** What the reader does now, with the keys that do it. */
function instructionKey(state: StoryState) {
  switch (state.step) {
    case 'highlight':
      return state.color
        ? 'workspaceOnboarding.highlight.done'
        : state.selected
          ? 'workspaceOnboarding.highlight.color'
          : 'workspaceOnboarding.highlight.select'
    case 'tools':
      return 'workspaceOnboarding.tools'
    case 'strong':
      return 'workspaceOnboarding.strong'
    case 'occurrences':
      return 'workspaceOnboarding.occurrences'
    case 'strobi':
      return state.strobi === 'question'
        ? 'workspaceOnboarding.strobi.ask'
        : state.strobi === 'thinking'
          ? 'workspaceOnboarding.strobi.thinking'
          : state.strobi === 'answer'
            ? 'workspaceOnboarding.strobi.answer'
            : 'workspaceOnboarding.strobi.accepted'
    case 'note':
      return state.noted ? 'workspaceOnboarding.noteDone' : 'workspaceOnboarding.note'
    case 'relations':
      return state.related ? 'workspaceOnboarding.relationsDone' : 'workspaceOnboarding.relations'
    case 'return':
      return state.returned ? 'workspaceOnboarding.returnDone' : 'workspaceOnboarding.return'
    case 'finish':
      return undefined
  }
}

type WorkspaceStoryProps = {
  onEnd: (end: StoryEnd) => void
}

/** The story of the Web and the desktop app, over the whole window. */
export default function WorkspaceStory({ onEnd }: WorkspaceStoryProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const reduce = useReducedMotion()
  const [state, dispatch] = useReducer(storyReducer, initialStoryState)
  const [offline, setOffline] = useState(false)
  const signedIn = useSelector((root: RootState) => Boolean(root.user.id))
  const rootRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const controlsInset = useWindowControlsInset()
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  useEffect(() => {
    trackOnboarding({ flow: 'story', step: state.step })
  }, [state.step])

  // Strobi's step is told when Remote Config opens the assistant. Its answer is heard until the
  // first step is left: no step appears or vanishes on the way.
  const opening = useAssistantOpening()
  const strobiOpen = assistantAvailable && (opening.open || isOnboardingForced)
  useEffect(() => {
    if (state.step === 'highlight') dispatch({ type: 'steps', withStrobi: strobiOpen })
  }, [state.step, strobiOpen])

  // Strobi thinks a moment before it answers. Nothing is sent: the answer is written in advance.
  useEffect(() => {
    if (state.strobi !== 'thinking') return
    const timer = setTimeout(() => dispatch({ type: 'strobiAnswered' }), reduce ? 0 : 1800)
    return () => clearTimeout(timer)
  }, [reduce, state.strobi])

  // The reader wants to try Strobi: once the story is over, the app offers it.
  const strobiRef = useRef<AvatarHandle | null>(null)
  const setStrobiTrialRequested = useSetAtom(strobiTrialRequestedAtom)
  useEffect(() => {
    if (state.strobi !== 'accepted') return
    setStrobiTrialRequested(true)
    strobiRef.current?.poke('nod')
  }, [setStrobiTrialRequested, state.strobi])

  // The lexicon opens on the proper name, then shows the common noun behind it.
  useEffect(() => {
    if (state.step !== 'strong') return
    const timer = setTimeout(() => {
      if (stateRef.current.step === 'strong' && stateRef.current.word === 'proper')
        dispatch({ type: 'word', word: 'common' })
    }, 2200)
    return () => clearTimeout(timer)
  }, [state.step])

  useEffect(() => {
    if (state.step === 'finish') primaryRef.current?.focus()
  }, [state.step])

  // The story holds the keyboard. It is a modal dialog, so the workspace and the reader leave
  // their keys alone while it shows (`isBlockingOverlayOpen`), and ⌘K waits for its end.
  useEffect(() => {
    if (offline) return
    const handleKey = (event: KeyboardEvent) => {
      if (stateRef.current.step === 'finish' || isEditingTarget(event.target)) return
      const action = storyActionForKey(event)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return
      dispatch(action)
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [offline])

  const end = (choice: StoryEnd) => {
    trackOnboarding({ flow: 'story', step: state.step, action: choice })
    onEnd(choice)
  }

  const press = (action: StoryAction) => () => dispatch(action)
  const nudgeOf = (id: string) => (state.nudge?.key === id ? state.nudge.count : 0)
  const key = (id: Parameters<typeof keysOf>[0], action?: StoryAction) => (
    <Keycap keys={keysOf(id)} nudge={nudgeOf(id)} onPress={action ? press(action) : undefined} />
  )
  const enter = <Keycap keys={['↵']} onPress={press({ type: 'next' })} />
  const slots: Record<string, ReactNode> = {
    select: key('nextVerse', { type: 'shortcut', id: 'nextVerse' }),
    first: (
      <Keycap
        keys={['1']}
        nudge={nudgeOf('highlight')}
        onPress={press({ type: 'shortcut', id: 'highlight', digit: 1 })}
      />
    ),
    last: <Keycap keys={['5']} onPress={press({ type: 'shortcut', id: 'highlight', digit: 5 })} />,
    lexicon: key('lexicon', { type: 'shortcut', id: 'lexicon' }),
    note: key('note', { type: 'shortcut', id: 'note' }),
    tags: key('tags', { type: 'shortcut', id: 'tags' }),
    relation: key('relation', { type: 'shortcut', id: 'relation' }),
    deselect: key('deselect', { type: 'shortcut', id: 'deselect' }),
    enter,
  }
  const instruction = instructionKey(state)
  const stepNumber = storyStepNumber(state.step, state.steps)
  const fade = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }

  // A reader who asked to try Strobi learns what signing in brings first.
  const finishBody =
    state.strobi === 'accepted' && !signedIn
      ? 'onboarding.abel.strobi.signIn'
      : IS_DESKTOP
        ? 'workspaceOnboarding.finish.desktopBody'
        : signedIn
          ? 'workspaceOnboarding.finish.signedInBody'
          : 'workspaceOnboarding.finish.webBody'

  const style = {
    ...webThemeVariables(theme.colors),
    '--onb-sans': resolveFontFamily(theme.fontFamily.text),
    '--onb-serif': webFontFamily('Literata Book'),
  } as CSSProperties

  return (
    <div
      ref={rootRef}
      className="bs-onb"
      role="dialog"
      aria-modal="true"
      aria-label={t('workspaceOnboarding.dialogLabel')}
      tabIndex={-1}
      style={style}
    >
      <div className="bs-onb-frame">
        <header
          className="bs-onb-header"
          style={{ '--onb-controls-inset': `${controlsInset}px` } as CSSProperties}
          {...(sidebarDragRegion ? { 'data-tauri-drag-region': 'deep' } : {})}
        >
          <span className="bs-onb-brand">
            <BrandMark size={24} />
            Bible Strong
          </span>
          {state.step !== 'finish' && (
            <button
              type="button"
              className="bs-onb-text-button"
              onClick={() => {
                trackOnboarding({ flow: 'story', step: state.step, action: 'skip' })
                dispatch({ type: 'finish' })
              }}
            >
              {t('onboarding.abel.skip')}
            </button>
          )}
        </header>

        <main className="bs-onb-main">
          <section className="bs-onb-copy" aria-live="polite">
            <div className="bs-onb-eyebrow">
              {state.step === 'finish'
                ? t('workspaceOnboarding.finish.eyebrow')
                : t('workspaceOnboarding.eyebrow', { step: stepNumber, total: state.steps.length })}
            </div>
            {/* Slots of fixed height: a title or an instruction of one line or two, or the
                instant between two of them, never moves the board. */}
            <div className="bs-onb-title-slot">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={phraseKey(state, signedIn)}
                  className="bs-onb-title"
                  {...fade}
                  transition={{ duration: 0.22 }}
                >
                  {t(phraseKey(state, signedIn))}
                </motion.h1>
              </AnimatePresence>
            </div>
            <div className="bs-onb-instruction-slot">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={instruction ?? 'finish'} {...fade} transition={{ duration: 0.18 }}>
                  {instruction ? (
                    <p className="bs-onb-instruction">{withKeys(t(instruction), slots)}</p>
                  ) : (
                    <p className="bs-onb-instruction bs-onb-instruction-muted">{t(finishBody)}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
          <StoryBoard state={state} dispatch={dispatch} strobiRef={strobiRef} />
        </main>

        <footer className="bs-onb-footer" data-finish={state.step === 'finish'}>
          <div>
            {state.step !== 'highlight' && (
              <button
                type="button"
                className="bs-onb-text-button"
                onClick={press({ type: 'back' })}
              >
                ← {t('workspaceOnboarding.back')}
              </button>
            )}
          </div>
          <div className="bs-onb-progress" aria-hidden="true">
            {state.steps.map((step, index) => (
              <span key={step} data-done={index < stepNumber} />
            ))}
          </div>
          {/* The end's choices take the place of Continue, the one solid button last. */}
          <div className="bs-onb-footer-end">
            {state.step !== 'finish' ? (
              <button
                type="button"
                className="bs-onb-button"
                onMouseDown={event => event.preventDefault()}
                onClick={press({ type: 'next' })}
              >
                {t('workspaceOnboarding.continue')}
                <kbd aria-hidden="true">↵</kbd>
              </button>
            ) : (
              <>
                {IS_DESKTOP && !signedIn && (
                  <button
                    type="button"
                    className="bs-onb-text-button"
                    onClick={() => end('signIn')}
                  >
                    {t('workspaceOnboarding.finish.signIn')}
                  </button>
                )}
                {(IS_DESKTOP || !signedIn) && (
                  <button
                    type="button"
                    className="bs-onb-text-button"
                    onClick={() => end('continue')}
                  >
                    {t(
                      IS_DESKTOP
                        ? 'workspaceOnboarding.finish.continueOnline'
                        : 'workspaceOnboarding.finish.continueGuest'
                    )}
                  </button>
                )}
                <button
                  ref={primaryRef}
                  type="button"
                  className="bs-onb-button"
                  onClick={() =>
                    IS_DESKTOP ? setOffline(true) : end(signedIn ? 'continue' : 'signIn')
                  }
                >
                  {t(
                    IS_DESKTOP
                      ? 'workspaceOnboarding.finish.offline'
                      : signedIn
                        ? 'workspaceOnboarding.finish.start'
                        : 'workspaceOnboarding.finish.signIn'
                  )}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

      {offline && (
        <div className="bs-onb-offline">
          <SelectResources onComplete={() => end('offline')} />
        </div>
      )}
    </div>
  )
}
