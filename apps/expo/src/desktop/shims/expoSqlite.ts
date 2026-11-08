/**
 * `expo-sqlite` for the desktop app, over the shell's SQLite
 * (`apps/desktop/src-tauri/src/sqlite.rs`). Metro substitutes it for the package in the desktop
 * build only. Every open is its own connection, as `useNewConnection: true` asks, and an
 * exclusive transaction runs on a connection of its own, as in expo-sqlite.
 */
import type * as ExpoSQLite from 'expo-sqlite'

import { desktopBootstrap } from '../bridge'
import { call, toFileUri } from '../call'

type BindValue = ExpoSQLite.SQLiteBindValue
type BindParams = ExpoSQLite.SQLiteBindParams
type RunResult = ExpoSQLite.SQLiteRunResult

/** `(sql, [a, b])`, `(sql, a, b)` or `(sql)`, as expo-sqlite accepts them. */
const normalizeParams = (params: unknown[]): BindValue[] => {
  if (params.length === 1 && Array.isArray(params[0])) return params[0] as BindValue[]
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object') {
    if (params[0] instanceof Uint8Array) return [params[0]]
    throw new Error('Named SQLite parameters are not supported in the desktop app')
  }
  return params as BindValue[]
}

const toWire = (value: BindValue) =>
  value instanceof Uint8Array ? Array.from(value) : value === undefined ? null : value

const joinPath = (directory: string, name: string) => `${directory.replace(/\/+$/u, '')}/${name}`

export class SQLiteDatabase {
  private released = false

  constructor(
    readonly databasePath: string,
    readonly options: ExpoSQLite.SQLiteOpenOptions | undefined,
    private readonly id: number
  ) {}

  private ensureOpen() {
    if (this.released) {
      throw new Error(`The database connection to ${this.databasePath} was already released`)
    }
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    this.ensureOpen()
    return call<T[]>('sqlite_all', {
      id: this.id,
      sql: source,
      params: normalizeParams(params).map(toWire),
    })
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    this.ensureOpen()
    return call<T | null>('sqlite_first', {
      id: this.id,
      sql: source,
      params: normalizeParams(params).map(toWire),
    })
  }

  async runAsync(source: string, ...params: unknown[]): Promise<RunResult> {
    this.ensureOpen()
    return call<RunResult>('sqlite_run', {
      id: this.id,
      sql: source,
      params: normalizeParams(params).map(toWire),
    })
  }

  async execAsync(source: string): Promise<void> {
    this.ensureOpen()
    await call('sqlite_exec', { id: this.id, sql: source })
  }

  async closeAsync(): Promise<void> {
    if (this.released) return
    this.released = true
    await call('sqlite_close', { id: this.id })
  }

  async withExclusiveTransactionAsync(task: (txn: SQLiteDatabase) => Promise<void>): Promise<void> {
    this.ensureOpen()
    const transaction = await openAt(this.databasePath, this.options)
    let failure: unknown
    try {
      await transaction.execAsync('BEGIN')
      await task(transaction)
      await transaction.execAsync('COMMIT')
    } catch (error) {
      try {
        await transaction.execAsync('ROLLBACK')
      } catch {
        // SQLite may already have rolled back; keep the original error.
      }
      failure = error
    } finally {
      await transaction.closeAsync()
    }
    if (failure) throw failure
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.ensureOpen()
    await this.execAsync('BEGIN')
    try {
      await task()
      await this.execAsync('COMMIT')
    } catch (error) {
      await this.execAsync('ROLLBACK').catch(() => undefined)
      throw error
    }
  }
}

const openAt = async (databasePath: string, options?: ExpoSQLite.SQLiteOpenOptions) => {
  const id = await call<number>('sqlite_open', { uri: toFileUri(databasePath) })
  return new SQLiteDatabase(databasePath, options, id)
}

export const defaultDatabaseDirectory = `${desktopBootstrap().documentDirectory}SQLite`

export async function openDatabaseAsync(
  databaseName: string,
  options?: ExpoSQLite.SQLiteOpenOptions,
  directory?: string
): Promise<SQLiteDatabase> {
  return openAt(joinPath(directory ?? defaultDatabaseDirectory, databaseName), options)
}

export async function deleteDatabaseAsync(databaseName: string, directory?: string): Promise<void> {
  const path = joinPath(directory ?? defaultDatabaseDirectory, databaseName)
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    await call('fs_delete', { uri: toFileUri(`${path}${suffix}`), idempotent: true })
  }
}

export type { BindParams as SQLiteBindParams, BindValue as SQLiteBindValue }
