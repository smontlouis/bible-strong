import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'

import { firebaseApp } from '~helpers/firebaseApp.web'

export type WebAuthStatus = 'unknown' | 'guest' | 'authenticated'

export const useWebAuthStatus = (): WebAuthStatus => {
  const [status, setStatus] = useState<WebAuthStatus>(() =>
    getAuth(firebaseApp).currentUser ? 'authenticated' : 'unknown'
  )

  useEffect(
    () =>
      onAuthStateChanged(getAuth(firebaseApp), user => {
        setStatus(user ? 'authenticated' : 'guest')
      }),
    []
  )

  return status
}
