type ConnectionEntry<Connection> = {
  connection?: Connection
  openPromise?: Promise<Connection>
  exclusivePromise?: Promise<void>
  activeUses: number
  idleResolvers: Set<() => void>
}

export class AsyncConnectionRegistry<Key, Connection> {
  private readonly entries = new Map<Key, ConnectionEntry<Connection>>()

  constructor(
    private readonly openConnection: (key: Key) => Promise<Connection>,
    private readonly closeConnection: (connection: Connection) => Promise<void>
  ) {}

  async use<Result>(
    key: Key,
    operation: (connection: Connection) => Promise<Result>
  ): Promise<Result> {
    let entry = this.getEntry(key)
    if (entry.exclusivePromise) {
      await entry.exclusivePromise
      entry = this.getEntry(key)
    }

    entry.activeUses += 1
    try {
      return await operation(await this.open(key, entry))
    } finally {
      entry.activeUses -= 1
      if (entry.activeUses === 0) {
        for (const resolve of entry.idleResolvers) resolve()
        entry.idleResolvers.clear()
      }
    }
  }

  async withExclusiveAccess<Result>(key: Key, operation: () => Promise<Result>): Promise<Result> {
    let entry = this.getEntry(key)
    if (entry.exclusivePromise) {
      await entry.exclusivePromise
      entry = this.getEntry(key)
    }

    const exclusiveOperation = (async () => {
      await this.waitForIdle(entry)
      const connection = entry.connection
      if (connection) await this.closeConnection(connection)
      return operation()
    })()
    entry.exclusivePromise = exclusiveOperation.then(
      () => undefined,
      () => undefined
    )

    try {
      return await exclusiveOperation
    } finally {
      if (this.entries.get(key) === entry) {
        this.entries.delete(key)
      }
    }
  }

  private getEntry(key: Key): ConnectionEntry<Connection> {
    const existing = this.entries.get(key)
    if (existing) return existing

    const entry: ConnectionEntry<Connection> = {
      activeUses: 0,
      idleResolvers: new Set(),
    }
    this.entries.set(key, entry)
    return entry
  }

  private async open(key: Key, entry: ConnectionEntry<Connection>): Promise<Connection> {
    if (entry.connection) return entry.connection
    if (entry.openPromise) return entry.openPromise

    const openPromise = this.openConnection(key)
    entry.openPromise = openPromise
    try {
      const connection = await openPromise
      entry.connection = connection
      return connection
    } finally {
      if (entry.openPromise === openPromise) {
        entry.openPromise = undefined
      }
    }
  }

  private waitForIdle(entry: ConnectionEntry<Connection>): Promise<void> {
    if (entry.activeUses === 0) return Promise.resolve()
    return new Promise(resolve => entry.idleResolvers.add(resolve))
  }
}
