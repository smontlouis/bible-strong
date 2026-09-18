import { LiveDictationAdapter } from '../dictationAdapter'

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
function setup(draftLength = 0) {
  const socket = {
    readyState: 0 as 0 | 1 | 2 | 3,
    bufferedAmount: 0,
    send: jest.fn(),
    close: jest.fn(),
    onopen: null as null | (() => void),
    onmessage: null as null | ((event: { data: string }) => void),
    onclose: null as null | (() => void),
    onerror: null as null | (() => void),
  }
  let signal: AbortSignal
  const audio = { sampleRate: 24000, stop: jest.fn(async () => {}) }
  const errors = jest.fn(),
    state = jest.fn()
  const adapter = new LiveDictationAdapter({
    connect: async () => ({ socket, providerOptions: { test: { interimResults: true } } }),
    capture: async s => {
      signal = s
      return audio
    },
    onError: errors,
    onState: state,
  })
  adapter.setTextLength(draftLength)
  const session = adapter.listen(),
    speech = jest.fn()
  session.onSpeech(speech)
  return {
    adapter,
    session,
    socket,
    audio,
    errors,
    state,
    speech,
    aborted: () => signal.aborted,
    open: () => {
      socket.readyState = 1
      socket.onopen?.()
    },
    frame: (value: object) => socket.onmessage?.({ data: JSON.stringify(value) }),
  }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('forwards server streaming options before audio so partial transcripts are requested', async () => {
  const s = setup()
  await flush()
  s.open()
  expect(JSON.parse(s.socket.send.mock.calls[0][0])).toEqual({
    type: 'transcription-stream.start',
    inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    providerOptions: { test: { interimResults: true } },
  })
  s.adapter.cancel()
})

it('previews partials, waits for final words after stop, then commits once', async () => {
  const s = setup()
  await flush()
  s.open()
  s.frame({ type: 'transcript-partial', text: 'Jean trois' })
  expect(s.speech).toHaveBeenLastCalledWith({ transcript: 'Jean trois', isFinal: false })
  const stopped = s.session.stop()
  await flush()
  expect(s.audio.stop).toHaveBeenCalledTimes(1)
  expect(s.socket.send).toHaveBeenLastCalledWith('{"type":"transcription-stream.audio-done"}')
  expect(s.session.status.type).toBe('running')
  s.frame({ type: 'finish', text: 'Jean 3:16' })
  await stopped
  expect(s.speech.mock.calls.filter(([r]) => r.isFinal)).toEqual([
    [{ transcript: 'Jean 3:16', isFinal: true }],
  ])
  expect(s.aborted()).toBe(true)
  expect(s.state).toHaveBeenLastCalledWith('idle')
})

it('cancels during microphone setup without connecting later', async () => {
  const s = setup()
  s.adapter.cancel()
  await flush()
  expect(s.audio.stop).toHaveBeenCalled()
  expect(s.socket.onopen).toBeNull()
  expect(s.aborted()).toBe(true)
  expect(s.errors).not.toHaveBeenCalled()
})

it('keeps partial text and releases capture when the socket disconnects', async () => {
  const s = setup()
  await flush()
  s.open()
  s.frame({ type: 'transcript-delta', delta: 'Habacuc' })
  s.socket.onclose?.()
  expect(s.speech).toHaveBeenLastCalledWith({ transcript: 'Habacuc', isFinal: false })
  expect(s.errors).toHaveBeenCalledTimes(1)
  expect(s.aborted()).toBe(true)
  s.frame({ type: 'finish', text: 'Late text' })
  expect(s.speech).toHaveBeenCalledTimes(1)
})

it('times out finalization rather than leaving the composer locked', async () => {
  const s = setup()
  await flush()
  s.open()
  const stopped = s.session.stop()
  await flush()
  jest.advanceTimersByTime(10000)
  await stopped
  expect(s.session.status).toEqual({ type: 'ended', reason: 'error' })
  expect(s.aborted()).toBe(true)
})

it('replaces partial hypotheses without duplicating finalized segments', async () => {
  const s = setup()
  await flush()
  s.open()
  s.frame({ type: 'transcript-partial', text: 'Jean' })
  s.frame({ type: 'transcript-final', text: 'Jean 3:16.' })
  s.frame({ type: 'transcript-partial', text: 'Explique ce' })
  s.frame({ type: 'transcript-partial', text: 'Explique ce passage.' })
  expect(s.speech).toHaveBeenLastCalledWith({
    transcript: 'Jean 3:16. Explique ce passage.',
    isFinal: false,
  })
  s.adapter.cancel()
})

it('handles a denied microphone with an actionable error', async () => {
  const error = new Error('denied')
  error.name = 'NotAllowedError'
  const report = jest.fn(),
    connect = jest.fn()
  const adapter = new LiveDictationAdapter({
    connect,
    capture: async () => {
      throw error
    },
    onError: report,
    onState: jest.fn(),
  })
  const session = adapter.listen()
  await flush()
  expect(report).toHaveBeenCalledWith('assistant.dictation.permission')
  expect(session.status.type).toBe('ended')
  expect(connect).not.toHaveBeenCalled()
})

it('reserves space for the existing draft and stops at the composer limit', async () => {
  const s = setup(3990)
  await flush()
  s.open()
  s.frame({ type: 'transcript-partial', text: 'Jean trois seize' })
  await flush()
  expect(s.speech).toHaveBeenLastCalledWith({ transcript: 'Jean troi', isFinal: false })
  expect(s.audio.stop).toHaveBeenCalledTimes(1)
  s.frame({ type: 'finish', text: 'Jean 3:16' })
  expect(s.speech).toHaveBeenLastCalledWith({ transcript: 'Jean 3:16', isFinal: true })
})
