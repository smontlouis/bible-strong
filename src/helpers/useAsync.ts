import { DependencyList, useEffect, useState } from 'react'
import { Status } from '~common/types'
import { to } from 'await-to-js'

const useAsync = <T>(fn: () => Promise<T>, deps: DependencyList = []) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()

  useEffect(() => {
    ;(async () => {
      setStatus('Pending')
      const [err, response] = await to(fn())
      if (!err) {
        setStatus('Resolved')
        setData(response)
      } else {
        setStatus('Rejected')
        setError(err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { status, data, error }
}

export default useAsync
