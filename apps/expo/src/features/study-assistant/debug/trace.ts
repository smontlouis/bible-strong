import { parseStudyEvent, type StudyEvent } from '@bible-strong/ai-contract/contract'
export type DebugEntry = {
  type: 'debug'
  sequence: number
  elapsedMs: number
  stage: string
  data: unknown
}
export type DebugSession = { token: string; expiresAt: number; uid: string }
export function parseDebugEntry(value: unknown): DebugEntry {
  if (!value || typeof value !== 'object') throw new Error('INVALID_DEBUG_STREAM')
  const entry = value as DebugEntry
  if (
    entry.type !== 'debug' ||
    !Number.isInteger(entry.sequence) ||
    entry.sequence < 1 ||
    entry.sequence > 251 ||
    !Number.isFinite(entry.elapsedMs) ||
    entry.elapsedMs < 0 ||
    typeof entry.stage !== 'string' ||
    entry.stage.length > 80
  )
    throw new Error('INVALID_DEBUG_STREAM')
  return {
    type: 'debug',
    sequence: entry.sequence,
    elapsedMs: entry.elapsedMs,
    stage: entry.stage,
    data: entry.data,
  }
}
export async function readDebugStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StudyEvent) => void,
  onDebug: (entry: DebugEntry) => void
) {
  const reader = body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    totalDebug = 0,
    sequence = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        if (block.length > 400000) throw new Error('INVALID_DEBUG_STREAM')
        const data = block
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, ''))
          .join('\n')
        if (!data) continue
        const parsed = JSON.parse(data)
        if (parsed.type === 'debug') {
          const entry = parseDebugEntry(parsed)
          totalDebug += data.length
          if (entry.sequence <= sequence || totalDebug > 6_000_000)
            throw new Error('INVALID_DEBUG_STREAM')
          sequence = entry.sequence
          onDebug(entry)
        } else {
          const event = parseStudyEvent(parsed)
          onEvent(event)
          if (event.type === 'done' || event.type === 'error') return
        }
      }
      if (buffer.length > 400000) throw new Error('INVALID_DEBUG_STREAM')
      if (done) throw new Error('INCOMPLETE_STREAM')
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
