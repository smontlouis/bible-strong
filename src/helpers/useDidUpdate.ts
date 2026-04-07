import { useEffect, useRef } from 'react'

const useDidUpdate = (callback: Function, deps: any[] = []) => {
  const hasMount = useRef(false)

  useEffect(() => {
    if (hasMount.current) {
      callback()
    } else {
      hasMount.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default useDidUpdate
