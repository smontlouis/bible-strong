import { useEffect, useState } from 'react'
import { Status } from '~common/types'
import to from 'await-to-js'

const useAsync = (fn: () => Promise<any>) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [data, setData] = useState()
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
  }, [])

  return { status, data, error }
}

export default useAsync
