export const dictationSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof AudioContext !== 'undefined' &&
  typeof AudioWorkletNode !== 'undefined'

// Capture mono PCM16 in small frames; never retain the recording.
const processor = `
class DictationPCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.samples = []; this.stopped = false;
    this.port.onmessage = () => {
      this.flush(); this.stopped = true; this.port.postMessage('stopped');
    };
  }
  flush() {
    if (!this.samples.length) return;
    const bytes = new ArrayBuffer(this.samples.length * 2);
    const view = new DataView(bytes);
    this.samples.forEach((sample, i) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(i * 2, value < 0 ? value * 32768 : value * 32767, true);
    });
    this.samples = []; this.port.postMessage(bytes, [bytes]);
  }
  process(inputs) {
    if (this.stopped) return false;
    const samples = inputs[0]?.[0];
    if (samples) for (const sample of samples) this.samples.push(sample);
    if (this.samples.length >= 2048) this.flush();
    return true;
  }
}
registerProcessor('dictation-pcm', DictationPCM);
`

export async function captureDictationAudio(
  signal: AbortSignal,
  onAudio: (bytes: ArrayBuffer) => void,
  onError: () => void
) {
  const context = new AudioContext({ sampleRate: 24000 })
  // Resume within the microphone button's user gesture (Safari).
  const resumed = context.resume()
  void resumed.catch(() => {})
  let media: MediaStream | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let worklet: AudioWorkletNode | undefined
  let stopAck: (() => void) | undefined
  let stopped = false
  const dispose = () => {
    stopped = true
    stopAck?.()
    media?.getTracks().forEach(track => track.stop())
    source?.disconnect()
    if (worklet) {
      worklet.disconnect()
      worklet.port.close()
    }
    void context.close().catch(() => {})
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  const url = URL.createObjectURL(new Blob([processor], { type: 'text/javascript' }))
  try {
    media = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
    if (signal.aborted) throw new Error('CANCELLED')
    await resumed
    await context.audioWorklet.addModule(url)
    if (signal.aborted) throw new Error('CANCELLED')
    worklet = new AudioWorkletNode(context, 'dictation-pcm')
    worklet.onprocessorerror = onError
    media.getAudioTracks().forEach(track =>
      track.addEventListener('ended', () => {
        if (!stopped) onError()
      })
    )
    worklet.port.onmessage = event => {
      if (event.data === 'stopped') stopAck?.()
      else if (!stopped && event.data instanceof ArrayBuffer) onAudio(event.data)
    }
    source = context.createMediaStreamSource(media)
    source.connect(worklet)
    // Processor output is silence; connecting keeps the worklet running.
    worklet.connect(context.destination)
    return {
      sampleRate: context.sampleRate,
      stop: async () => {
        if (stopped) return
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 300)
          stopAck = () => {
            clearTimeout(timeout)
            resolve()
          }
          worklet?.port.postMessage('stop')
        })
        dispose()
      },
    }
  } catch (error) {
    dispose()
    throw error
  } finally {
    URL.revokeObjectURL(url)
    void resumed.catch(() => {})
  }
}
