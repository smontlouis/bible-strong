import { useState } from 'react'

export const useMountTime = (): number => {
  const [mountTime] = useState(Date.now)
  return mountTime
}
