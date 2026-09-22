import { WebHaptics, type Vibration } from 'web-haptics'

/** Haptic vocabulary shared by every World interface. Android uses the Vibration API;
 * iOS Safari relies on web-haptics' hidden switch toggle, which only responds inside a
 * user gesture, so button presses feel stronger than asynchronous outcomes there. */
const patterns = {
  tap: [{ duration: 12, intensity: 0.6 }],
  select: [{ duration: 22, intensity: 0.85 }],
  tick: [{ duration: 10, intensity: 0.5 }],
  nudge: [
    { duration: 70, intensity: 0.8 },
    { delay: 70, duration: 40, intensity: 0.35 },
  ],
  success: [
    { duration: 30, intensity: 0.8 },
    { delay: 60, duration: 55, intensity: 1 },
  ],
  star: [
    { duration: 25, intensity: 0.7 },
    { delay: 40, duration: 25, intensity: 0.85 },
    { delay: 40, duration: 70, intensity: 1 },
  ],
  error: [
    { duration: 45, intensity: 0.9 },
    { delay: 50, duration: 45, intensity: 0.9 },
    { delay: 50, duration: 80, intensity: 1 },
  ],
  win: [
    { duration: 30, intensity: 0.6 },
    { delay: 50, duration: 30, intensity: 0.7 },
    { delay: 50, duration: 30, intensity: 0.85 },
    { delay: 50, duration: 40, intensity: 1 },
    { delay: 80, duration: 120, intensity: 1 },
  ],
} satisfies Record<string, Vibration[]>

export type HapticName = keyof typeof patterns

let engine: WebHaptics | null = null
function instance() {
  if (!engine) engine = new WebHaptics()
  return engine
}

export function haptic(name: HapticName) {
  if (typeof window === 'undefined') return
  try {
    void instance().trigger(patterns[name])
  } catch {
    // Haptics are a bonus; a missing API must never break the interface.
  }
}

/** Every enabled control gives a light tap on press, app-wide. */
export function installButtonHaptics(root: Document = document) {
  const handler = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || !(event.target instanceof Element)) return
    const control = event.target.closest(
      'button, [role="button"], summary, select, a[href], input[type="checkbox"], input[type="radio"], input[type="range"]'
    )
    if (!control) return
    if ((control as HTMLButtonElement).disabled || control.getAttribute('aria-disabled') === 'true')
      return
    haptic('tap')
  }
  root.addEventListener('pointerdown', handler, { passive: true })
  return () => root.removeEventListener('pointerdown', handler)
}
