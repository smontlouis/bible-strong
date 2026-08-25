import { Data, Duration, Effect } from 'effect'

export class DatabaseFailure extends Data.TaggedError('DatabaseFailure')<{
  readonly operation: string
  readonly code: 'QUERY_FAILED' | 'TIMEOUT'
  readonly message: 'Database operation failed'
  readonly cause: unknown
}> {}

export type DatabaseOperationOptions = {
  retries?: number
  timeout?: Duration.DurationInput
}

export const tryDatabasePromise = <A>(
  operation: string,
  run: (signal: AbortSignal) => Promise<A>,
  options: DatabaseOperationOptions = {}
) => {
  const query = Effect.tryPromise({
    try: signal => run(signal),
    catch: cause =>
      new DatabaseFailure({
        operation,
        code: 'QUERY_FAILED',
        message: 'Database operation failed',
        cause,
      }),
  })
  const retried = options.retries ? query.pipe(Effect.retry({ times: options.retries })) : query
  const timed = options.timeout
    ? retried.pipe(
        Effect.timeoutFail({
          duration: options.timeout,
          onTimeout: () =>
            new DatabaseFailure({
              operation,
              code: 'TIMEOUT',
              message: 'Database operation failed',
              cause: undefined,
            }),
        })
      )
    : retried

  return timed.pipe(Effect.withSpan(operation))
}
