import type { AvatarHandle } from '@bible-strong/avatar-react-native'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import OnboardingStrobi from '~features/onboarding/abel/OnboardingStrobi'

import type { StoryAction, StoryState, StoryStep } from './storyMachine'
import './workspace-strobi.css'

/** The box Strobi is drawn in, in board points; each step scales it. */
const STROBI_BOX = 120

type StrobiDirection = {
  /** Centre and size, in board points. */
  x: number
  y: number
  size: number
  state?: string
  clip?: string
  /** Right and up, each from -1 to 1. */
  lookAt?: readonly [number, number]
}

/**
 * Where Strobi stands at each step of the story, between the cards, and where it looks: at what
 * the step asks of the reader. The same states as the phone's scenes.
 */
const STROBI_AT: Record<Exclude<StoryStep, 'strobi'>, StrobiDirection> = {
  // Above the verse, looking down at it.
  highlight: { x: 250, y: 120, size: 84, clip: 'Idle_B', lookAt: [0.25, -0.8] },
  // Between the verse and the tools, looking at the tools.
  tools: { x: 480, y: 90, size: 70, state: 'idle', lookAt: [0.8, 0] },
  // Under the lexicon, looking up at it.
  strong: { x: 460, y: 330, size: 64, state: 'surprised', lookAt: [0.6, 0.5] },
  // Above the concordance, looking down at it.
  occurrences: { x: 460, y: 110, size: 64, state: 'reading', lookAt: [0.5, -0.7] },
  // Beside the note, looking at it.
  note: { x: 460, y: 520, size: 70, state: 'listening', lookAt: [-0.8, -0.1] },
  // Under the study, looking up at it.
  relations: { x: 440, y: 140, size: 62, state: 'proud', lookAt: [-0.7, 0.4] },
  return: { x: 880, y: 330, size: 88, state: 'celebrate', lookAt: [-0.8, 0] },
  finish: { x: 880, y: 330, size: 88, state: 'celebrate', lookAt: [-0.8, 0] },
}

/** Strobi's step: it stands above its panel, as the assistant does in its window. */
const strobiStepDirection = (state: StoryState): StrobiDirection => {
  const at = { x: 760, y: 96, size: 120 }
  switch (state.strobi) {
    case 'question':
      return { ...at, state: 'controlling', lookAt: [0, -0.6] }
    case 'thinking':
      return { ...at, state: 'thinking' }
    case 'answer':
      return { ...at, state: 'happy', lookAt: [-0.2, -0.85] }
    case 'accepted':
      return { ...at, state: 'happy', lookAt: [0, -0.85] }
  }
}

/** The guide of the story, on the board: touching it makes it spin, nothing more. */
export function StoryStrobi({
  state,
  strobiRef,
}: {
  state: StoryState
  strobiRef: RefObject<AvatarHandle | null>
}) {
  const reduce = useReducedMotion()
  const direction = state.step === 'strobi' ? strobiStepDirection(state) : STROBI_AT[state.step]
  return (
    <motion.button
      type="button"
      className="bs-onb-strobi"
      aria-hidden="true"
      tabIndex={-1}
      onMouseDown={event => event.preventDefault()}
      onClick={() => strobiRef.current?.poke('spin')}
      style={{ width: STROBI_BOX, height: STROBI_BOX, left: 0, top: 0 }}
      initial={false}
      animate={{
        x: direction.x - STROBI_BOX / 2,
        y: direction.y - STROBI_BOX / 2,
        scale: direction.size / STROBI_BOX,
      }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 22 }}
    >
      <OnboardingStrobi
        ref={strobiRef}
        state={direction.state}
        clip={direction.clip}
        lookAt={direction.lookAt ?? null}
        size={STROBI_BOX}
      />
    </motion.button>
  )
}

/** The panel of Strobi's step, in the place of the lexicon and the concordance. */
export function StrobiPanel({
  state,
  dispatch,
}: {
  state: StoryState
  dispatch: (action: StoryAction) => void
}) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const asked = state.strobi !== 'question'
  const answered = state.strobi === 'answer' || state.strobi === 'accepted'
  const appear = (delay = 0) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 12, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0 },
          transition: { type: 'spring' as const, stiffness: 260, damping: 26, delay },
        }
  return (
    <motion.div
      className="bs-onb-strobi-panel"
      style={{ left: 540, top: 176, width: 440 }}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <button
        type="button"
        className="bs-onb-strobi-question"
        data-asked={asked}
        disabled={asked}
        onMouseDown={event => event.preventDefault()}
        onClick={() => dispatch({ type: 'askStrobi' })}
      >
        <span>{t('onboarding.abel.sceneStrobi.question')}</span>
        {!asked && (
          <span className="bs-onb-strobi-send" aria-hidden="true">
            ↑
          </span>
        )}
      </button>

      <AnimatePresence>
        {answered && (
          <motion.div key="answer" className="bs-onb-strobi-answer" {...appear()}>
            <div className="bs-onb-strobi-answer-label">
              <span aria-hidden="true">✦</span>
              {t('onboarding.abel.sceneStrobi.answerLabel')}
            </div>
            <p>{t('onboarding.abel.sceneStrobi.answer')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.strobi === 'answer' && (
          <motion.div key="offer" className="bs-onb-strobi-offer" {...appear(0.35)}>
            <button
              type="button"
              className="bs-onb-button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => dispatch({ type: 'tryStrobi' })}
            >
              {t('onboarding.abel.sceneStrobi.try')}
            </button>
            <button
              type="button"
              className="bs-onb-text-button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => dispatch({ type: 'next' })}
            >
              {t('onboarding.abel.sceneStrobi.later')}
            </button>
          </motion.div>
        )}
        {state.strobi === 'accepted' && (
          <motion.div key="accepted" className="bs-onb-strobi-accepted" role="status" {...appear()}>
            <span className="bs-onb-strobi-check" aria-hidden="true">
              ✓
            </span>
            <span>{t('onboarding.abel.sceneStrobi.accepted')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
