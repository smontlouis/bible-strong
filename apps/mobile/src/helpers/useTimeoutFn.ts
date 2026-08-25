import { useEffect, useRef } from 'react'

export default function useTimeoutFn(
  fn: () => void,
  ms: number = 0
): [() => boolean | null, () => void, () => void] {
  const ready = useRef<boolean | null>(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callback = useRef<() => void>(fn)

  const isReady = (): boolean | null => ready.current

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = (): void => {
    ready.current = false
    timeout.current && clearTimeout(timeout.current)

    timeout.current = setTimeout(() => {
      ready.current = true
      callback.current()
    }, ms)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clear = (): void => {
    ready.current = null
    timeout.current && clearTimeout(timeout.current)
  }

  // update ref when function changes
  useEffect(() => {
    callback.current = fn
  }, [fn])

  // set on mount, clear on unmount
  useEffect(() => {
    set()

    return clear
  }, [clear, ms, set])

  return [isReady, clear, set]
}
