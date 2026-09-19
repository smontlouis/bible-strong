import type { DictationAdapter } from '@assistant-ui/react'

type DictationSocket = Pick<
  WebSocket,
  | 'readyState'
  | 'bufferedAmount'
  | 'send'
  | 'close'
  | 'onopen'
  | 'onmessage'
  | 'onerror'
  | 'onclose'
>
type AudioCapture = { sampleRate: number; stop: () => Promise<void> }
export type DictationConnection = {
  socket: DictationSocket
  providerOptions?: Record<string, unknown>
}
type Dependencies = {
  connect: (signal: AbortSignal) => Promise<DictationConnection>
  capture: (
    signal: AbortSignal,
    onAudio: (bytes: ArrayBuffer) => void,
    onError: () => void
  ) => Promise<AudioCapture>
  onError: (key: string) => void
  onState: (state: 'idle' | 'starting' | 'listening' | 'stopping') => void
}

/** Transcription-stream v1 transport, independent of the server-selected model. */
export class LiveDictationAdapter implements DictationAdapter {
  disableInputDuringDictation = true
  private session?: DictationAdapter.Session
  private maxCharacters = 4000
  setTextLength(length: number) {
    this.maxCharacters = Math.max(0, 4000 - length - (length ? 1 : 0))
  }
  constructor(private dependencies: Dependencies) {}
  cancel() {
    this.session?.cancel()
  }

  listen(): DictationAdapter.Session {
    this.cancel()
    const deps = this.dependencies
    const abort = new AbortController()
    const speech = new Set<(result: DictationAdapter.Result) => void>()
    const start = new Set<() => void>()
    const end = new Set<(result: DictationAdapter.Result) => void>()
    let socket: DictationSocket | undefined
    let audio: AudioCapture | undefined
    let stopping = false
    let streaming = false
    let finished = false
    let transcript = ''
    let finalized = ''
    const limit = this.maxCharacters
    let settle!: () => void
    const done = new Promise<void>(resolve => {
      settle = resolve
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const emit = (text: string, isFinal = false) => {
      transcript = text.slice(0, limit)
      for (const cb of speech) cb({ transcript, isFinal })
    }
    const finish = (reason: 'stopped' | 'cancelled' | 'error') => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      abort.abort()
      socket?.close()
      session.status = { type: 'ended', reason }
      for (const cb of end) cb({ transcript, isFinal: true })
      deps.onState('idle')
      settle()
    }
    const fail = (key = 'assistant.dictation.error') => {
      if (finished) return
      // Keep the partial text visible and editable after a disconnect.
      finish('error')
      deps.onError(key)
    }
    const session: DictationAdapter.Session = {
      status: { type: 'starting' },
      stop: async () => {
        if (finished || stopping) return done
        stopping = true
        deps.onState('stopping')
        if (!audio || !socket || socket.readyState !== 1) {
          finish('cancelled')
          return done
        }
        clearTimeout(timer)
        timer = setTimeout(() => fail(), 10000)
        try {
          await audio.stop()
          if (!finished && socket.readyState === 1)
            socket.send(JSON.stringify({ type: 'transcription-stream.audio-done' }))
        } catch {
          fail()
        }
        return done
      },
      cancel: () => finish('cancelled'),
      onSpeech: cb => {
        speech.add(cb)
        return () => speech.delete(cb)
      },
      onSpeechStart: cb => {
        start.add(cb)
        return () => start.delete(cb)
      },
      onSpeechEnd: cb => {
        end.add(cb)
        return () => end.delete(cb)
      },
    }
    this.session = session
    deps.onState('starting')
    timer = setTimeout(() => fail(), 20000)
    // Capture starts in the user gesture. Drop audio until the socket is ready.
    const captured = deps.capture(
      abort.signal,
      bytes => {
        if (!finished && streaming && socket?.readyState === 1) {
          if (socket.bufferedAmount > 256000) {
            fail()
            return
          }
          try {
            socket.send(bytes)
          } catch {
            fail()
          }
        }
      },
      () => fail()
    )
    void (async () => {
      try {
        audio = await captured
        if (finished) {
          await audio.stop()
          return
        }
        const connection = await deps.connect(abort.signal)
        socket = connection.socket
        if (finished) {
          socket.close()
          return
        }
        socket.onopen = () => {
          if (finished) return
          socket!.send(
            JSON.stringify({
              type: 'transcription-stream.start',
              inputAudioFormat: { type: 'audio/pcm', rate: audio!.sampleRate },
              ...(connection.providerOptions && { providerOptions: connection.providerOptions }),
            })
          )
          streaming = true
          session.status = { type: 'running' }
          deps.onState('listening')
          for (const cb of start) cb()
          clearTimeout(timer)
          timer = setTimeout(() => {
            void session.stop()
          }, 120000)
        }
        socket.onmessage = event => {
          if (finished || typeof event.data !== 'string') return
          try {
            if (event.data.length > 128000) throw new Error('FRAME_TOO_LARGE')
            const part = JSON.parse(event.data)
            switch (part.type) {
              case 'transcript-delta':
                if (typeof part.delta !== 'string') throw new Error('INVALID_FRAME')
                emit(transcript + part.delta)
                break
              case 'transcript-partial':
                if (typeof part.text !== 'string') throw new Error('INVALID_FRAME')
                emit([finalized, part.text].filter(Boolean).join(' '))
                break
              case 'transcript-final':
                if (typeof part.text !== 'string') throw new Error('INVALID_FRAME')
                finalized = [finalized, part.text].filter(Boolean).join(' ')
                emit(finalized)
                break
              case 'finish':
                if (typeof part.text !== 'string') throw new Error('INVALID_FRAME')
                emit(part.text, true)
                finish('stopped')
                return
              case 'error':
                fail()
                return
            }
            if (transcript.length >= limit) void session.stop()
          } catch {
            fail()
          }
        }
        socket.onerror = () => fail()
        socket.onclose = () => {
          if (!finished) fail()
        }
      } catch (error) {
        const name = error instanceof Error ? error.name : ''
        const message = error instanceof Error ? error.message : ''
        fail(
          name === 'NotAllowedError'
            ? 'assistant.dictation.permission'
            : message === 'DAILY_LIMIT'
              ? 'assistant.limit'
              : 'assistant.dictation.error'
        )
      }
    })()
    return session
  }
}
