import { useEffect, useRef } from 'react'

export default function useTimeoutFn(
  fn: () => void,
  ms: number = 0
): [() => boolean | null, () => void, () => void] {
  const ready = useRef<boolean | null>(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callback = useRef<() => void>(fn)

  const isReady = (): boolean | null => ready.current

  const set = (): void => {
    ready.current = false
    timeout.current && clearTimeout(timeout.current)

    timeout.current = setTimeout(() => {
      ready.current = true
      callback.current()
    }, ms)
  }

  const clear = (): void => {
    ready.current = null
    timeout.current && clearTimeout(timeout.current)
  }

  // update ref when function changes
  useEffect(() => {
    callback.current = fn
  }, [fn])

  // Re-arm after every render and clear on unmount: set and clear used to be new
  // on every render, so the previous dependency list never held the effect back.
  useEffect(() => {
    set()

    return clear
  })

  return [isReady, clear, set]
}
