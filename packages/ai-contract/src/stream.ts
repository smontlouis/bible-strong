import { parseStudyEvent, type StudyEvent } from './contract'
export async function* readStudyStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StudyEvent> {
  const reader = body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    data: string[] = [],
    completed = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let match: RegExpExecArray | null
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        if (!done && match[0] === '\r' && match.index === buffer.length - 1) break
        const line = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        if (!line && data.length) {
          const event = parseStudyEvent(JSON.parse(data.join('\n')))
          data = []
          yield event
          if (event.type === 'done' || event.type === 'error') {
            completed = true
            return
          }
        } else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (buffer.length > 200000 || data.join('').length > 200000) throw new Error('INVALID_STREAM')
      if (done) break
    }
    if (!completed) throw new Error('INCOMPLETE_STREAM')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
