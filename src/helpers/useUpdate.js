import { useState } from 'react'

const useUpdate = () => {
  const [, setState] = useState(0)
  const updateCb = () => setState(cnt => cnt + 1)
  return updateCb
}

export default useUpdate
