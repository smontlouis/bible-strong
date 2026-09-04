import useTimeoutFn from './useTimeoutFn'
import useUpdate from './useUpdate'

export default function useTimeout(ms: number = 0): [() => boolean | null, () => void, () => void] {
  const update = useUpdate()

  return useTimeoutFn(update, ms)
}
