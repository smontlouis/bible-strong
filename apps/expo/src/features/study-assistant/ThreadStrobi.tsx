import { useEffect, useRef, useState } from 'react'
import Animated, { FadeOut, withSpring, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { useAssistantSheet } from './assistantSheetContext'
import StrobiAvatar from './StrobiAvatar'
import { failedCalls, runMood, runningTool, type StrobiMood } from './strobiMood'
import { toolActivityChip, toolActivityKind } from './toolActivity'

const STROBI_SIZE = 40
/** The row keeps one height whatever it says: the thread measures it to hold its anchor. */
const ROW_HEIGHT = 48
/** Each state plays at least this long: steps that follow each other quickly do not flicker. */
const HOLD_MS = 900
/** A read that failed: Strobi is confused this long, then goes on. */
const CONFUSED_MS = 1400
/** The answer is complete: Strobi shows it is finished this long, then rests. */
const FINISHED_MS = 1600
/** At rest, it holds its pose this long, eyes open, then stops computing frames. */
const SETTLE_MS = 1500

// Strobi comes in with the bounce of its floating button.
const landing = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.5 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ scale: withSpring(1, { duration: 500, dampingRatio: 0.6 }) }],
    },
  }
}

/** The state shown, which changes only once the previous one has played for `HOLD_MS`. */
function useHeldMood(target: StrobiMood) {
  const [shown, setShown] = useState(target)
  const since = useRef(Date.now())
  useEffect(() => {
    if (target === shown) return
    const wait = Math.max(0, HOLD_MS - (Date.now() - since.current))
    const timer = setTimeout(() => {
      since.current = Date.now()
      setShown(target)
    }, wait)
    return () => clearTimeout(timer)
  }, [target, shown])
  return shown
}

/**
 * Strobi at the end of the conversation, in the place of the spinners (`floating`: the same, in a
 * pill over the composer while its place in the conversation is below the screen): it shows what the run is
 * doing (listening, searching, reading, thinking, writing) with a line that says it, goes down
 * with the answer as it is written, is confused for a moment when a read fails, and shows it is
 * finished, then rests at the end of the last answer, still: its row never goes, so the page
 * does not jump when an answer ends (2026-11-14). Errors have their own card, with their own Strobi.
 */
export default function ThreadStrobi({ floating = false }: { floating?: boolean }) {
  const { t } = useTranslation()
  const { session } = useAssistantSheet()
  const { busy, progress, progressKey = '', error, current } = session
  const last = current.messages.at(-1)
  const tools = (last?.role === 'assistant' && last.tools) || []

  // The answer just completed: Strobi stays a moment to show it.
  const [finishing, setFinishing] = useState(false)
  const wasBusy = useRef(busy)
  useEffect(() => {
    const ended = wasBusy.current && !busy
    wasBusy.current = busy
    if (!ended || error || last?.state !== 'complete') return
    setFinishing(true)
    const timer = setTimeout(() => setFinishing(false), FINISHED_MS)
    return () => clearTimeout(timer)
  }, [busy, error, last?.state])

  // A read that failed while the run goes on.
  const [confused, setConfused] = useState(false)
  const failed = failedCalls(tools).join(',')
  const seenFailed = useRef(failed)
  useEffect(() => {
    if (failed === seenFailed.current) return
    const added = failed.length > seenFailed.current.length
    seenFailed.current = failed
    if (!added || !busy) return
    setConfused(true)
    const timer = setTimeout(() => setConfused(false), CONFUSED_MS)
    return () => clearTimeout(timer)
  }, [failed, busy])

  const target: StrobiMood = !busy
    ? finishing
      ? 'finished'
      : 'idle'
    : confused
      ? 'confused'
      : runMood(progressKey, tools)
  const mood = useHeldMood(target)
  // After an answer, and on a conversation opened again, it waits under the last answer.
  const resting =
    !busy &&
    !error &&
    last?.role === 'assistant' &&
    ['complete', 'interrupted'].includes(last.state)
  const visible = busy || finishing || (!floating && resting)
  if (!visible) return null

  const reading = busy && progressKey !== 'assistant.writing' ? runningTool(tools) : undefined
  const line = reading
    ? `${t(`assistant.tools.${toolActivityKind(reading)}`)} · ${toolActivityChip(reading, t)}`
    : busy
      ? progress
      : ''

  return (
    <Animated.View exiting={FadeOut.duration(220)}>
      <HStack
        className={
          floating
            ? 'bg-surface-raised max-w-full items-center gap-2 pl-[6px] pr-[16px]'
            : 'items-center gap-2'
        }
        style={
          floating
            ? { height: ROW_HEIGHT, borderRadius: radii.pill, ...floatingShadow }
            : { height: ROW_HEIGHT }
        }
      >
        <Animated.View
          entering={landing}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Box style={{ width: STROBI_SIZE, height: STROBI_SIZE }}>
            <StrobiAvatar
              animation={mood}
              size={STROBI_SIZE}
              settleAfterMs={!busy && !finishing ? SETTLE_MS : 0}
            />
          </Box>
        </Animated.View>
        {!!line && (
          <Text
            accessibilityLiveRegion={floating ? 'none' : 'polite'}
            className={floating ? 'text-grey shrink text-[16px]' : 'text-grey flex-1 text-[16px]'}
            numberOfLines={1}
          >
            {line}
          </Text>
        )}
      </HStack>
    </Animated.View>
  )
}
