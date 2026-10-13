// React Native 0.88 removed InteractionManager. Its runAfterInteractions deferred work until the
// JS thread was no longer busy with touches and animations; an idle callback gives the same
// deferral, and the timeout keeps the task from waiting forever on a busy thread.
const IDLE_TIMEOUT_MS = 1000

export const runAfterInteractions = (task: () => void | Promise<void>) => {
  if (typeof requestIdleCallback !== 'function') {
    const timeout = setTimeout(task, 0)
    return { cancel: () => clearTimeout(timeout) }
  }

  const handle = requestIdleCallback(() => void task(), { timeout: IDLE_TIMEOUT_MS })
  return { cancel: () => cancelIdleCallback(handle) }
}
