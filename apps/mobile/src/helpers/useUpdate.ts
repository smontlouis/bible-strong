import { useState } from 'react'

const useUpdate = (): (() => void) => {
  const [, setState] = useState(0)
  const updateCb = (): void => setState(cnt => cnt + 1)
  return updateCb
}

export default useUpdate
