import { AsyncConnectionRegistry } from '../asyncConnectionRegistry'

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('AsyncConnectionRegistry', () => {
  it('shares one opening connection between concurrent operations', async () => {
    const finishOpening = deferred<{ id: string }>()
    const openConnection = jest.fn(() => finishOpening.promise)
    const registry = new AsyncConnectionRegistry(openConnection, async () => {})

    const first = registry.use('strong-core', async database => database)
    const second = registry.use('strong-core', async database => database)
    expect(openConnection).toHaveBeenCalledTimes(1)

    const connection = { id: 'core' }
    finishOpening.resolve(connection)

    await expect(Promise.all([first, second])).resolves.toEqual([connection, connection])
  })

  it('keeps a connection open until an active operation completes', async () => {
    const operationStarted = deferred()
    const finishOperation = deferred()
    const events: string[] = []
    const connection = { id: 'fr' }
    const registry = new AsyncConnectionRegistry(
      async () => connection,
      async () => {
        events.push('closed')
      }
    )

    const operation = registry.use('interlinear-fr', async database => {
      expect(database).toBe(connection)
      events.push('operation-started')
      operationStarted.resolve()
      await finishOperation.promise
      events.push('operation-finished')
    })
    await operationStarted.promise

    const closing = registry.withExclusiveAccess('interlinear-fr', async () => {})
    await Promise.resolve()
    expect(events).toEqual(['operation-started'])

    finishOperation.resolve()
    await Promise.all([operation, closing])

    expect(events).toEqual(['operation-started', 'operation-finished', 'closed'])
  })

  it('does not open a replacement connection until an exclusive mutation completes', async () => {
    const mutationStarted = deferred()
    const finishMutation = deferred()
    const events: string[] = []
    const registry = new AsyncConnectionRegistry(
      async () => {
        events.push('opened')
        return { id: 'fr' }
      },
      async () => {
        events.push('closed')
      }
    )

    const mutation = registry.withExclusiveAccess('interlinear-fr', async () => {
      events.push('mutation-started')
      mutationStarted.resolve()
      await finishMutation.promise
      events.push('mutation-finished')
    })
    await mutationStarted.promise

    const operation = registry.use('interlinear-fr', async () => {
      events.push('operation-started')
    })
    await Promise.resolve()
    expect(events).toEqual(['mutation-started'])

    finishMutation.resolve()
    await Promise.all([mutation, operation])

    expect(events).toEqual(['mutation-started', 'mutation-finished', 'opened', 'operation-started'])
  })

  it('allows queued operations to continue after an exclusive mutation fails', async () => {
    const mutationStarted = deferred()
    const finishMutation = deferred()
    const connection = { id: 'fr' }
    const registry = new AsyncConnectionRegistry(
      async () => connection,
      async () => {}
    )

    const mutation = registry.withExclusiveAccess('interlinear-fr', async () => {
      mutationStarted.resolve()
      await finishMutation.promise
      throw new Error('installation failed')
    })
    await mutationStarted.promise

    const operation = registry.use('interlinear-fr', async database => database)
    finishMutation.resolve()

    await expect(mutation).rejects.toThrow('installation failed')
    await expect(operation).resolves.toBe(connection)
  })
})
