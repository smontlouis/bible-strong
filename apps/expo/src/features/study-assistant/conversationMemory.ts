import type { HistoryMessage } from '@bible-strong/ai-contract/contract'
import type { Conversation, LocalMessage } from './conversations'
export type MemoryCheckpoint = {
  version: 'memory-2'
  summary: string
  coveredPairs: number
  throughId: string
  digest: string
}
export type Compactor = (
  input: { summary: string; history: HistoryMessage[] },
  signal: AbortSignal
) => Promise<string>
export const MEMORY_POLICY = {
  threshold: 32000,
  recent: 12000,
  summary: 3000,
  batch: 96000,
  maxCalls: 4,
} as const
export function validCheckpoint(value: unknown): value is MemoryCheckpoint {
  if (!value || typeof value !== 'object') return false
  const c = value as MemoryCheckpoint
  return (
    c.version === 'memory-2' &&
    typeof c.summary === 'string' &&
    !!c.summary.trim() &&
    c.summary.length <= 3000 &&
    Number.isInteger(c.coveredPairs) &&
    c.coveredPairs > 0 &&
    c.coveredPairs <= 150 &&
    typeof c.throughId === 'string' &&
    c.throughId.length <= 100 &&
    typeof c.digest === 'string' &&
    /^[a-f0-9]{64}$/.test(c.digest)
  )
}
function pairs(messages: LocalMessage[]) {
  const result: { id: string; history: HistoryMessage[]; size: number }[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const u = messages[i],
      a = messages[i + 1]
    if (
      u.role !== 'user' ||
      a.role !== 'assistant' ||
      a.state !== 'complete' ||
      !u.text.trim() ||
      !a.text.trim()
    )
      continue
    const content = `${u.context ? `[Contexte de ce message : ${u.context.detail}]\n` : ''}${u.text}`
    result.push({
      id: a.id,
      history: [
        { role: 'user', content },
        { role: 'assistant', content: a.text },
      ],
      size: content.length + a.text.length,
    })
  }
  return result
}
const fingerprint = async (value: unknown) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
    )
  )
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
export async function prepareMemory(
  conversation: Conversation,
  compact: Compactor,
  signal: AbortSignal,
  onCheckpoint: (checkpoint: MemoryCheckpoint) => void,
  onCompact: () => void
) {
  const all = pairs(conversation.messages)
  let checkpoint = conversation.memory,
    covered = 0,
    summary = ''
  if (
    validCheckpoint(checkpoint) &&
    all[checkpoint.coveredPairs - 1]?.id === checkpoint.throughId &&
    (await fingerprint(all.slice(0, checkpoint.coveredPairs))) === checkpoint.digest
  ) {
    covered = checkpoint.coveredPairs
    summary = checkpoint.summary
  }
  let calls = 0
  while (
    summary.length + all.slice(covered).reduce((n, p) => n + p.size, 0) >
    MEMORY_POLICY.threshold
  ) {
    if (signal.aborted) throw new Error('INTERRUPTED')
    if (calls++ >= MEMORY_POLICY.maxCalls) throw new Error('COMPACTION_FAILED')
    let keep = 0,
      recent = 0
    for (let i = all.length - 1; i >= covered; i--) {
      if (recent + all[i].size > MEMORY_POLICY.recent) {
        if (keep === 0 && all[i].size <= MEMORY_POLICY.threshold - MEMORY_POLICY.summary) keep = 1
        break
      }
      keep++
      recent += all[i].size
    }
    const end = all.length - keep
    let batchEnd = covered,
      batchSize = 0
    while (batchEnd < end && batchSize + all[batchEnd].size <= MEMORY_POLICY.batch) {
      batchSize += all[batchEnd].size
      batchEnd++
    }
    if (batchEnd === covered) throw new Error('COMPACTION_FAILED')
    onCompact()
    const nextSummary = await compact(
      { summary, history: all.slice(covered, batchEnd).flatMap(p => p.history) },
      signal
    )
    if (signal.aborted) throw new Error('INTERRUPTED')
    if (typeof nextSummary !== 'string' || !nextSummary.trim() || nextSummary.length > 3000)
      throw new Error('COMPACTION_FAILED')
    covered = batchEnd
    summary = nextSummary.trim()
    checkpoint = {
      version: 'memory-2',
      summary,
      coveredPairs: covered,
      throughId: all[covered - 1].id,
      digest: await fingerprint(all.slice(0, covered)),
    }
    onCheckpoint(checkpoint)
  }
  return { history: all.slice(covered).flatMap(p => p.history), memorySummary: summary }
}
