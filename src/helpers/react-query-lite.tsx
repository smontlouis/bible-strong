import React from 'react'
import { usePrevious } from './usePrevious'

export type QueryStatus = 'idle' | 'loading' | 'error' | 'success'

type QueryClientProviderProps = {
  children: React.ReactNode
  client: QueryClient
}

type QueryResult<TData = unknown> = {
  status: QueryStatus
  isLoading: boolean
  data: TData | undefined
  error: unknown | undefined
  lastUpdated?: number
}

type QueryObserver<TData = unknown> = {
  notify: () => void
  getResult: () => QueryResult<TData>
  subscribe: (notifyCallback: () => void) => () => void
  fetch: () => void
}

type QueryOptions<TData> = {
  queryKey: string | string[]
  queryFn: () => Promise<TData>
  staleTime?: number
  cacheTime?: number
  enabled?: boolean
}

type Query<TData = unknown> = {
  queryKey: string | string[]
  queryHash: string
  promise: Promise<TData> | null
  subscribers: QueryObserver<TData>[]
  gcTimeout: number | undefined
  state: QueryResult<TData>
  subscribe: (subscriber: QueryObserver<TData>) => () => void
  scheduleGC: () => void
  unscheduleGC: () => void
  setState: (updater: (x: QueryResult<TData>) => QueryResult<TData>) => void
  fetch: () => Promise<TData>
}

const Context = React.createContext<QueryClient | undefined>(undefined)

export class QueryClient {
  queries: Query[]

  constructor() {
    this.queries = []
  }

  getQuery = <TData,>(options: Omit<QueryOptions<TData>, 'staleTime'>) => {
    const queryHash = JSON.stringify(options.queryKey)
    let query = this.queries.find(d => d.queryHash === queryHash) as Query<
      TData
    >

    if (!query) {
      query = createQuery<TData>(this, options)
      this.queries.push(query as Query<unknown>)
    }

    return query
  }
}

export function QueryClientProvider({
  children,
  client,
}: QueryClientProviderProps) {
  return <Context.Provider value={client}>{children}</Context.Provider>
}

export function useQuery<TData = unknown>({
  queryKey,
  queryFn,
  staleTime,
  cacheTime,
  enabled = true,
}: QueryOptions<TData>) {
  const client = React.useContext(Context)
  const prevEnabled = usePrevious(enabled)
  const queryHash = JSON.stringify(queryKey)
  const prevQueryHash = usePrevious(queryHash)

  if (!client) {
    throw new Error('No query client found')
  }

  const [, rerender] = React.useReducer(i => i + 1, 0)

  const observerRef = React.useRef<QueryObserver<TData>>()

  if (
    (!observerRef.current && enabled) ||
    (prevEnabled !== enabled && enabled) ||
    (prevQueryHash !== queryHash && enabled)
  ) {
    observerRef.current = createQueryObserver(client, {
      queryKey,
      queryFn,
      staleTime,
      cacheTime,
    })
  }

  React.useEffect(() => {
    if (!enabled) {
      return
    }

    const unsubscribe = observerRef.current!.subscribe(rerender)

    return () => {
      unsubscribe()
    }
  }, [enabled, queryHash])

  return (
    observerRef.current?.getResult() || {
      status: 'idle',
      isLoading: false,
      data: undefined,
      error: undefined,
    }
  )
}

function createQuery<TData>(
  client: QueryClient,
  { queryKey, queryFn, cacheTime = 5 * 60 * 1000 }: QueryOptions<TData>
) {
  let query: Query<TData> = {
    queryKey,
    queryHash: JSON.stringify(queryKey),
    promise: null,
    subscribers: [],
    gcTimeout: undefined,
    state: {
      status: 'loading',
      isLoading: true,
      data: undefined,
      error: undefined,
    },
    subscribe: subscriber => {
      query.subscribers.push(subscriber)
      query.unscheduleGC()

      return () => {
        query.subscribers = query.subscribers.filter(d => d !== subscriber)

        if (!query.subscribers.length) {
          query.scheduleGC()
        }
      }
    },
    scheduleGC: () => {
      query.gcTimeout = window.setTimeout(() => {
        client.queries = client.queries.filter(d => d !== query)
      }, cacheTime)
    },
    unscheduleGC: () => {
      window.clearTimeout(query.gcTimeout)
    },
    setState: updater => {
      query.state = updater(query.state)
      query.subscribers.forEach(subscriber => subscriber.notify())
    },
    fetch: () => {
      if (!query.promise) {
        query.promise = (async () => {
          query.setState(old => ({
            ...old,
            isLoading: true,
            error: undefined,
          }))

          try {
            const data = await queryFn()
            query.setState(old => ({
              ...old,
              status: 'success',
              lastUpdated: Date.now(),
              data,
            }))
          } catch (error) {
            console.log({ error })
            query.setState(old => ({
              ...old,
              status: 'error',
              error,
            }))
          } finally {
            query.promise = null
            query.setState(old => ({
              ...old,
              isLoading: false,
            }))
          }
        })() as Promise<TData>
      }

      return query.promise!
    },
  }

  return query
}

function createQueryObserver<TData>(
  client: QueryClient,
  { queryKey, queryFn, staleTime = 0, cacheTime }: QueryOptions<TData>
) {
  const query = client.getQuery<TData>({ queryKey, queryFn, cacheTime })

  const observer: QueryObserver<TData> = {
    notify: () => {},
    getResult: () => query.state,
    subscribe: notifyCallback => {
      observer.notify = notifyCallback
      const unsubscribe = query.subscribe(observer)

      observer.fetch()

      return unsubscribe
    },
    fetch: () => {
      if (
        !query.state.lastUpdated ||
        Date.now() - query.state.lastUpdated > staleTime
      ) {
        query.fetch()
      }
    },
  }

  return observer
}
