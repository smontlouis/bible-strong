import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio'

export const dictationSupported = () => true

/** Capture mono PCM16 from the device microphone in small frames; never retain the recording. */
export async function captureDictationAudio(
  signal: AbortSignal,
  onAudio: (bytes: ArrayBuffer) => void,
  onError: () => void
) {
  const permission = await requestRecordingPermissionsAsync()
  if (!permission.granted) {
    const denied = new Error('MICROPHONE_DENIED')
    // The dictation adapter recognizes a refusal by the browser's error name.
    denied.name = 'NotAllowedError'
    throw denied
  }
  if (signal.aborted) throw new Error('CANCELLED')
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
  // The native module object is typed, but the lint rule cannot follow its members.
  // eslint-disable-next-line import/namespace
  const stream = new AudioModule.AudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16' })
  let stopped = false
  let started = false
  const buffers = stream.addListener('audioStreamBuffer', buffer => {
    if (!stopped) onAudio(buffer.data)
  })
  const status = stream.addListener('audioStreamStatus', ({ isStreaming }) => {
    // The system can end a capture on its own (call, another recording app).
    if (started && !isStreaming && !stopped) onError()
  })
  const dispose = () => {
    if (stopped) return
    stopped = true
    signal.removeEventListener('abort', dispose)
    buffers.remove()
    status.remove()
    try {
      stream.stop()
    } catch {
      /* Already released by the system. */
    }
    stream.release()
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    await stream.start()
    started = true
    if (signal.aborted) throw new Error('CANCELLED')
    return {
      sampleRate: stream.sampleRate || 24000,
      stop: async () => dispose(),
    }
  } catch (error) {
    dispose()
    throw error
  }
}
