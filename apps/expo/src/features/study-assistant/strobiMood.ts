import type { ToolActivity } from '@bible-strong/ai-contract/contract'
import { toolActivityIsSearch } from './toolActivity'

/**
 * What Strobi plays in the conversation: states of the avatar catalogue, each the sign of a
 * moment of the run, in the place of the spinners (2026-11-14).
 */
export type StrobiMood =
  | 'idle'
  | 'listening'
  | 'curious'
  | 'searching'
  | 'reading'
  | 'thinking'
  | 'writing'
  | 'finished'
  | 'confused'
  | 'failed'
  | 'working'

/** The progress key of each step, as the session reports it, and the state that shows it. */
const MOOD_BY_PROGRESS: Record<string, StrobiMood> = {
  'assistant.preparing': 'listening',
  'assistant.steps.analyzing': 'curious',
  'assistant.steps.searching': 'searching',
  'assistant.searching': 'searching',
  'assistant.steps.thinking': 'thinking',
  'assistant.steps.reading': 'reading',
  'assistant.steps.reviewing': 'thinking',
  'assistant.steps.composing': 'writing',
  'assistant.writing': 'writing',
}

/**
 * Strobi's state during a run: a resource being read says more than the step around it, a search
 * shows it searching, any other read shows it reading. Before the service names a step, it listens.
 */
export function runMood(progressKey: string, tools: readonly ToolActivity[]): StrobiMood {
  const reading = tools.findLast(tool => tool.state === 'running')
  if (reading && progressKey !== 'assistant.writing')
    return toolActivityIsSearch(reading) ? 'searching' : 'reading'
  return MOOD_BY_PROGRESS[progressKey] ?? 'listening'
}

/** The resource being read, if any: what the line beside Strobi names. */
export const runningTool = (tools: readonly ToolActivity[]) =>
  tools.findLast(tool => tool.state === 'running')

/** Reads that failed, by call: a new one makes Strobi confused for a moment. */
export const failedCalls = (tools: readonly ToolActivity[]) =>
  tools.filter(tool => tool.state === 'error').map(tool => tool.callId)
