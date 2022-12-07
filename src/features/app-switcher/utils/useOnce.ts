import { useRef } from 'react'

const useOnce = (callback: Function) => {
  const isFirstRender = useRef(true)

  if (isFirstRender.current) {
    callback()
    isFirstRender.current = false
  }
}

export default useOnce
