import { createContext, use, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  View,
  type FlatList,
  type LayoutRectangle,
  type ViewProps,
} from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { ThreadPrimitive } from '@assistant-ui/react-native'
import { useTranslation } from 'react-i18next'
import { useKeyboardState } from '~common/KeyboardAwareScrollView'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { useTheme } from '~themes/ThemeProvider'
import AssistantLimitCard from './AssistantLimitCard'
import { ComposerInsetContext, useAssistantSheet } from './assistantSheetContext'
import type { ReadingContext } from './conversations'
import ErrorState from './ErrorState'
import FollowUpQuestions from './FollowUpQuestions'
import { AssistantMessage, UserMessage } from './MessageRenderer'

/** Starting points offered on an empty conversation, chosen from what the reader has open. */
const shortcutsFor = (context: ReadingContext | null) =>
  context && ['plan', 'meditation', 'entity', 'person', 'place', 'timeline'].includes(context.kind)
    ? ['editorialExplain', 'editorialReferences', 'editorialReflect']
    : context?.kind === 'word'
      ? ['word', 'usage']
      : context?.kind === 'commentary'
        ? ['commentaryExplain', 'commentaryDistinguish']
        : context?.kind === 'dictionary'
          ? ['articleExplain', 'articleReferences']
          : context?.kind === 'nave'
            ? ['topicExplain', 'topicPassages']
            : context
              ? ['explain', 'context', 'question']
              : ['start', 'theme']

function ThreadStatus() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const { session } = useAssistantSheet()
  const { current, busy, ready, error, retrying, progress, storageError, context, followUps } =
    session
  return (
    <Box>
      {!!progress && (
        <HStack accessibilityLiveRegion="polite" className="items-center gap-2 py-1">
          <ActivityIndicator size="small" color={colors.grey} />
          <Text className="text-grey text-[13px]">{progress}</Text>
        </HStack>
      )}
      {error === 'assistant.limit' && !retrying ? (
        <AssistantLimitCard />
      ) : (
        (!!error || retrying) && (
          <ErrorState
            retrying={retrying}
            title={t(
              error === 'assistant.limit'
                ? 'assistant.errors.limitTitle'
                : error === 'assistant.signIn'
                  ? 'assistant.errors.signInTitle'
                  : 'assistant.errors.title'
            )}
            detail={t(error === 'assistant.limit' ? 'assistant.errors.limitDetail' : error)}
            onRetry={session.retry}
          />
        )
      )}
      {storageError && (
        <ErrorState
          title={t('assistant.errors.storageTitle')}
          detail={t('assistant.modal.storageError')}
        />
      )}
      {!!followUps.length && !error && (
        <FollowUpQuestions questions={followUps} disabled={busy || !ready} />
      )}
      {!current.messages.length && (
        <Box className="mt-2 gap-2">
          {shortcutsFor(context).map(key => (
            <ThreadPrimitive.Suggestion
              key={key}
              prompt={t(`assistant.modal.prompt.${key}`)}
              send
              disabled={busy || !ready}
              className="bg-light-grey flex-row items-center gap-2 rounded-[12px] px-4 py-3"
            >
              <Text className="text-link">›</Text>
              <Text className="flex-1 text-[15px]">{t(`assistant.modal.action.${key}`)}</Text>
            </ThreadPrimitive.Suggestion>
          ))}
        </Box>
      )}
    </Box>
  )
}

function Welcome() {
  const { t } = useTranslation()
  const { session } = useAssistantSheet()
  return (
    <Box className="pb-4 pt-8">
      <Text className="text-[24px] font-bold">{t('assistant.modal.welcome')}</Text>
      <Text className="text-grey mt-2 text-[15px]">
        {t(session.context ? 'assistant.modal.contextIntro' : 'assistant.modal.intro')}
      </Text>
    </Box>
  )
}

/** Space kept above the question the page settles on. */
const ANCHOR_MARGIN = 12
/** How much of the answer must lie below the screen before the way down is offered. */
const JUMP_THRESHOLD = 80
/** Opening a conversation: its last question is held in place while the cards above load. */
const SETTLE_MS = 1500

type Anchor = {
  /** The question the page settles on. */
  question: string
  /** A question just asked: room is kept under its answer so it can reach the top. */
  run: boolean
  pending: boolean
  animated: boolean
  settleUntil: number
  /**
   * Once risen, the question stays at the top while its short answer is written: the end of
   * the page shrinks (the progress line goes) before the room under it grows back.
   */
  holdFrom?: number
}

type CellLayout = Pick<LayoutRectangle, 'y' | 'height'>

/** Lets each cell of the list say where it sits in the conversation, by message id. */
const CellLayoutContext = createContext<{ current: (id: string, layout: CellLayout) => void }>({
  current: () => {},
})

function MeasuredCell({
  cellKey,
  item: _item,
  onLayout,
  ...props
}: ViewProps & { cellKey: string; index: number; item: unknown }) {
  const report = use(CellLayoutContext)
  return (
    <View
      {...props}
      onLayout={event => {
        onLayout?.(event)
        report.current(cellKey, event.nativeEvent.layout)
      }}
    />
  )
}

/**
 * The conversation reads from the top (2026-11-08): a question just asked rises to the top of
 * the page and its answer is written below it, without the page following the text. The
 * reader scrolls at their own pace; a button takes them to the end. Opening a conversation
 * shows its last question at the top, not the end of its last answer.
 */
export default function AssistantThread() {
  const { t } = useTranslation()
  const { session } = useAssistantSheet()
  const { current, busy, error } = session
  const composer = use(ComposerInsetContext)
  // The composer rides the keyboard without resizing the list: the list makes room itself.
  const keyboardHeight = useKeyboardState(state => (state.isVisible ? state.height : 0))
  const paddingBottom = composer.height + keyboardHeight + 12
  const list = useRef<FlatList>(null)
  const metrics = useRef({ viewport: 0, content: 0, scrollY: 0, status: 0 })
  const cells = useRef(new Map<string, CellLayout>())
  const anchor = useRef<Anchor | null>(null)
  const seen = useRef<{ conversation: string; question?: string; last?: string } | null>(null)
  const reserveRef = useRef(0)
  const [reserve, setReserve] = useState(0)
  const [jumpVisible, setJumpVisible] = useState(false)
  // A reader at the end stays there when the keyboard (or a longer input) pushes it up.
  // Unknown until the first scroll or layout: the composer measuring itself on opening is not a
  // keyboard pushing a reader at the end.
  const atEnd = useRef(false)
  const stickUntil = useRef(0)
  const previousPadding = useRef(paddingBottom)
  const cellLayout = useRef((_id: string, _layout: CellLayout) => {})
  const messages = current.messages
  let questionIndex = messages.length - 1
  while (questionIndex >= 0 && messages[questionIndex].role !== 'user') questionIndex--
  const questionId = questionIndex >= 0 ? messages[questionIndex].id : undefined
  const lastId = messages.at(-1)?.id

  // A scroll sent to a list already unmounted (a reload with the page open) crashed React
  // Native once in `dispatchCommand`: nothing is sent once the page is gone.
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    []
  )
  const scrollTo = (params: { offset: number; animated: boolean }) => {
    if (mounted.current) list.current?.scrollToOffset(params)
  }
  /** Where the conversation itself ends, the room kept under it left out. */
  const contentEnd = () => {
    const last = lastId ? cells.current.get(lastId) : undefined
    return last ? last.y + last.height + metrics.current.status + paddingBottom : undefined
  }
  const updateReserve = () => {
    const target = anchor.current
    const question = target?.run ? cells.current.get(target.question) : undefined
    const end = contentEnd()
    const { viewport } = metrics.current
    let next = 0
    if (target?.run) {
      if (!question || end === undefined || !viewport) return
      next = Math.max(0, question.y - ANCHOR_MARGIN + viewport - end)
    }
    if (Math.abs(next - reserveRef.current) < 1) return
    reserveRef.current = next
    setReserve(next)
  }
  const tryAnchor = () => {
    const target = anchor.current
    // An opened conversation is settled for a moment only, whatever happens later.
    if (target?.pending && !target.run && Date.now() > target.settleUntil) target.pending = false
    const { viewport, content, scrollY } = metrics.current
    if (!target || (!target.pending && target.holdFrom === undefined) || !viewport || !content)
      return
    const max = Math.max(0, content - viewport)
    const question = cells.current.get(target.question)
    if (!question) {
      // A long conversation has not laid its last question out yet: the end brings it in.
      if (!target.run) scrollTo({ offset: max, animated: false })
      return
    }
    const offset = Math.max(0, question.y - ANCHOR_MARGIN)
    // A question just asked waits for the room under it before it rises.
    if (target.run && max + 1 < offset) return
    if (target.pending) {
      scrollTo({ offset: Math.min(offset, max), animated: target.animated })
      if (target.run) {
        target.pending = false
        target.holdFrom = Date.now() + (target.animated ? 450 : 0)
      }
      return
    }
    // Only ever back up to the question, never down after the text.
    if (target.holdFrom !== undefined && Date.now() >= target.holdFrom && scrollY < offset - 1)
      scrollTo({ offset, animated: false })
  }
  const stickToEnd = () => {
    // A question being settled on, or held at the top, keeps its place.
    const target = anchor.current
    if (target?.pending || target?.holdFrom !== undefined) return
    if (Date.now() > stickUntil.current) return
    const end = contentEnd()
    const { viewport, content, scrollY } = metrics.current
    if (end === undefined || !viewport) return
    const offset = Math.min(end, content) - viewport
    if (offset > scrollY + 1) scrollTo({ offset, animated: true })
  }
  const updateJump = () => {
    const end = contentEnd()
    const { viewport, scrollY } = metrics.current
    const below = end !== undefined && viewport ? end - (scrollY + viewport) : 0
    atEnd.current = below <= 24
    const visible = below > JUMP_THRESHOLD
    setJumpVisible(previous => (previous === visible ? previous : visible))
  }
  const releaseAnchor = () => {
    if (!anchor.current) return
    if (!anchor.current.run) anchor.current.pending = false
    anchor.current.holdFrom = undefined
  }
  const refresh = () => {
    updateReserve()
    tryAnchor()
    stickToEnd()
    updateJump()
  }
  cellLayout.current = (id, layout) => {
    cells.current.set(id, { y: layout.y, height: layout.height })
    refresh()
  }

  useEffect(() => {
    const previous = seen.current
    seen.current = { conversation: current.id, question: questionId, last: lastId }
    if (
      previous?.conversation === current.id &&
      previous.question === questionId &&
      previous.last === lastId
    )
      return
    if (!questionId) {
      anchor.current = null
      refresh()
      return
    }
    // A question asked here rises with an animation; one found on opening is simply there.
    const asked = previous?.conversation === current.id && busy
    anchor.current = {
      question: questionId,
      run: busy && messages.at(-1)?.role === 'assistant',
      pending: true,
      animated: asked,
      settleUntil: Date.now() + SETTLE_MS,
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, questionId, lastId])
  // The composer's own changes (keyboard, longer input) move the end, not the answer.
  useEffect(() => {
    if (paddingBottom > previousPadding.current && atEnd.current)
      stickUntil.current = Date.now() + 600
    previousPadding.current = paddingBottom
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddingBottom])

  return (
    <CellLayoutContext.Provider value={cellLayout}>
      <Box className="flex-1">
        <ThreadPrimitive.MessagesFlatList
          ref={list}
          // The page never follows the text: the reader keeps their place while it is written.
          autoScroll={false}
          scrollToBottomOnRunStart={false}
          scrollToBottomOnInitialize={false}
          scrollToBottomOnThreadSwitch={false}
          CellRendererComponent={MeasuredCell}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={32}
          onLayout={event => {
            metrics.current.viewport = event.nativeEvent.layout.height
            refresh()
          }}
          onContentSizeChange={(_width, height) => {
            metrics.current.content = height
            refresh()
          }}
          onScroll={event => {
            metrics.current.scrollY = event.nativeEvent.contentOffset.y
            updateJump()
          }}
          // The reader took over (a drag, or a tap on the status bar): the page stays put.
          onScrollBeginDrag={releaseAnchor}
          onScrollToTop={releaseAnchor}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            // The composer already clears the home indicator within its own height.
            paddingBottom,
          }}
          ListHeaderComponent={messages.length ? null : Welcome}
          ListFooterComponent={
            <>
              <View
                onLayout={event => {
                  metrics.current.status = event.nativeEvent.layout.height
                  refresh()
                }}
              >
                <ThreadStatus />
              </View>
              {/* Room under a short answer, so its question can sit at the top of the page. */}
              <View style={{ height: reserve }} />
            </>
          }
        >
          {({ message }) =>
            message.role === 'user' ? (
              <UserMessage />
            ) : (
              <AssistantMessage busy={busy} error={error} lastMessageId={lastId} />
            )
          }
        </ThreadPrimitive.MessagesFlatList>
        {jumpVisible && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            pointerEvents="box-none"
            className="absolute left-0 right-0 items-center"
            style={{ bottom: paddingBottom - 2 }}
          >
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={t('assistant.modal.toEnd')}
              onPress={() => {
                const end = contentEnd()
                if (end === undefined) return
                scrollTo({
                  offset: Math.max(0, end - metrics.current.viewport),
                  animated: true,
                })
              }}
              className="bg-surface-raised h-[36px] w-[36px] items-center justify-center"
              style={{ borderRadius: radii.pill, ...floatingShadow }}
            >
              <FeatherIcon name="arrow-down" size={18} />
            </TouchableBox>
          </Animated.View>
        )}
      </Box>
    </CellLayoutContext.Provider>
  )
}
