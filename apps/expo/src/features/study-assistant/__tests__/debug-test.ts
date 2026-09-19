import { TextDecoder, TextEncoder } from 'node:util'
import { ReadableStream } from 'node:stream/web'
import { readDebugStream, parseDebugEntry } from '../debug/trace'
Object.assign(globalThis, { TextDecoder, TextEncoder, ReadableStream })
const stream = (text: string, size = 7) =>
  new globalThis.ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(text)
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size))
      controller.close()
    },
  })
const debug = {
  type: 'debug',
  sequence: 1,
  elapsedMs: 2,
  stage: 'jev_decision',
  data: { assessment: { decision: 'DIRECT_REPLY' } },
}
const done = { type: 'done', requestId: 'r', model: '', modelCalls: 0, toolCalls: 0 }
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`
it('separates private traces from normal conversation events across fragmented UTF-8', async () => {
  const publicEvents: unknown[] = [],
    traces: unknown[] = []
  await readDebugStream(
    stream(frame(debug) + frame({ type: 'delta', text: 'Bonjour église' }) + frame(done)),
    e => publicEvents.push(e),
    e => traces.push(e)
  )
  expect(traces).toEqual([debug])
  expect(publicEvents).toEqual([{ type: 'delta', text: 'Bonjour église' }, done])
})
it('rejects invalid trace sequences and incomplete streams', async () => {
  await expect(
    readDebugStream(
      stream(frame(debug) + frame(debug) + frame(done)),
      () => {},
      () => {}
    )
  ).rejects.toThrow('INVALID_DEBUG_STREAM')
  await expect(
    readDebugStream(
      stream(frame(debug)),
      () => {},
      () => {}
    )
  ).rejects.toThrow('INCOMPLETE_STREAM')
  expect(() => parseDebugEntry({ ...debug, sequence: 1000 })).toThrow('INVALID_DEBUG_STREAM')
  expect(() => parseDebugEntry({ ...debug, elapsedMs: -1 })).toThrow('INVALID_DEBUG_STREAM')
})
it('cancels the reader at completion and respects normal public event validation', async () => {
  const cancel = jest.fn()
  const body = new globalThis.ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frame(done)))
    },
    cancel,
  })
  await readDebugStream(
    body,
    () => {},
    () => {}
  )
  expect(cancel).toHaveBeenCalled()
  await expect(
    readDebugStream(
      stream(frame({ type: 'invented' })),
      () => {},
      () => {}
    )
  ).rejects.toThrow('INVALID_STREAM')
})
