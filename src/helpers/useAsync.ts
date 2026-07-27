import { type QueryKey, useQuery } from '@tanstack/react-query'
import { Status } from '~common/types'

const useAsync = <T>(queryKey: QueryKey, queryFn: () => Promise<T>) => {
  const { data, error, isPending, isError } = useQuery({
    queryKey,
    queryFn,
  })
  const status: Status = isPending ? 'Pending' : isError ? 'Rejected' : 'Resolved'

  return { status, data, error }
}

export default useAsync
