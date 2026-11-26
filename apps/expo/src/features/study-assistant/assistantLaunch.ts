import { atom, getDefaultStore } from 'jotai'
import type { ReadingContext } from './conversations'

/**
 * A page asks Strobi to open on a new conversation pinned to what it shows: a question at the end
 * of a verse meditation (2026-11-26). The launcher at the root of the app, which holds the
 * session, takes the request and opens its sheet (native) or its window (web).
 */
export type AssistantLaunch = {
  context: ReadingContext
  title: string
  requestedAt: number
}

export const assistantLaunchAtom = atom<AssistantLaunch | null>(null)

export const requestAssistantConversation = (context: ReadingContext, title: string) =>
  getDefaultStore().set(assistantLaunchAtom, { context, title, requestedAt: Date.now() })

/** A request older than this is dropped: the reader has moved on. */
export const LAUNCH_TTL_MS = 10_000
