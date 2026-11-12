import { atom, getDefaultStore } from 'jotai'
import type {
  StudyStep,
  StudyWidget,
  ToolActivitySummary,
} from '@bible-strong/ai-contract/contract'
import type { ConversationRequest } from '../conversationRun'

export type ScriptedAnswer = { answer: string; widgets: StudyWidget[]; followUps?: string[] }

/**
 * Development only: answers played through the real conversation path in place of the
 * service, which App Check refuses in simulators. The run, the reveal pace, the cards and the
 * scrolling behave as with a real answer. Turned on from the cards playground (`/ai-widgets`),
 * or from a console with `__BIBLE_STRONG_SCRIPTED_ANSWERS__([{ answer, widgets }])`.
 */
export const scriptedAnswersAtom = atom<ScriptedAnswer[] | null>(null)

if (__DEV__) {
  Object.assign(globalThis, {
    __BIBLE_STRONG_SCRIPTED_ANSWERS__: (answers: ScriptedAnswer[] | null) =>
      getDefaultStore().set(scriptedAnswersAtom, answers?.length ? answers : null),
  })
}

let played = 0

/**
 * Streams the next answer about as the service does: its steps, two resources read with what they
 * found, then fast, uneven chunks.
 */
export const scriptedRequest =
  (answers: ScriptedAnswer[]): ConversationRequest =>
  async (_request, signal, emit) => {
    const { answer, widgets, followUps } = answers[played++ % answers.length]
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(new Error('INTERRUPTED'))
        const timer = setTimeout(resolve, ms)
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(new Error('INTERRUPTED'))
          },
          { once: true }
        )
      })
    // The steps and the reads of a real answer (2026-11-12): the library first, then a passage.
    emit({ type: 'status', message: 'analyzing' })
    await wait(700)
    emit({ type: 'status', message: 'searching' })
    const reads: {
      name: string
      target: object
      summary?: ToolActivitySummary
      then: StudyStep
    }[] = [
      {
        name: 'search_library',
        target: { query: 'réponse scriptée' },
        summary: { count: 17 },
        then: 'thinking',
      },
      { name: 'read_passage', target: { reference: 'Philippiens 4:6-7' }, then: 'composing' },
    ]
    for (const { name, target, summary, then } of reads) {
      const tool = { callId: `scripted-${name}`, name, request: JSON.stringify(target) }
      if (name === 'read_passage') emit({ type: 'status', message: 'reading' })
      emit({ type: 'tool', ...tool, result: '', state: 'running' })
      await wait(900)
      emit({
        type: 'tool',
        ...tool,
        result: 'ok',
        state: 'complete',
        ...(summary ? { summary } : {}),
      })
      emit({ type: 'status', message: then })
      await wait(900)
    }
    widgets.forEach(widget => emit({ type: 'widget', widget }))
    for (let index = 0; index < answer.length; ) {
      const size = 6 + Math.floor(Math.random() * 30)
      emit({ type: 'delta', text: answer.slice(index, index + size) })
      index += size
      await wait(30)
    }
    // The service suggests what to ask next while it checks the answer, just before the end.
    if (followUps?.length) {
      await wait(400)
      emit({ type: 'follow_ups', questions: followUps })
    }
    emit({ type: 'done', requestId: 'scripted', model: 'scripted', modelCalls: 0, toolCalls: 0 })
  }
