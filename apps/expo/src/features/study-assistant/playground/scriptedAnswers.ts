import { atom, getDefaultStore } from 'jotai'
import type { StudyWidget } from '@bible-strong/ai-contract/contract'
import type { ConversationRequest } from '../conversationRun'

export type ScriptedAnswer = { answer: string; widgets: StudyWidget[] }

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

/** Streams the next answer about as the model does: a pause to search, then fast, uneven chunks. */
export const scriptedRequest =
  (answers: ScriptedAnswer[]): ConversationRequest =>
  async (_request, signal, emit) => {
    const { answer, widgets } = answers[played++ % answers.length]
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
    emit({ type: 'status', message: 'resources' })
    await wait(800)
    widgets.forEach(widget => emit({ type: 'widget', widget }))
    for (let index = 0; index < answer.length; ) {
      const size = 6 + Math.floor(Math.random() * 30)
      emit({ type: 'delta', text: answer.slice(index, index + size) })
      index += size
      await wait(30)
    }
    emit({ type: 'done', requestId: 'scripted', model: 'scripted', modelCalls: 0, toolCalls: 0 })
  }
