import useTimeoutFn from './useTimeoutFn'
import useUpdate from './useUpdate'

export default function useTimeout(ms = 0) {
  const update = useUpdate()

  return useTimeoutFn(update, ms)
}
