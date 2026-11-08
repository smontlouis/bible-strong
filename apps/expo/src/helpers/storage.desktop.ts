/**
 * The desktop app's key-value store, MMKV's counterpart (ADR-0107).
 *
 * Reads are synchronous, as the mobile code expects, from the snapshot the shell serves before
 * the bundle runs. Writes go to the shell's SQLite store in the order they were made, batched
 * while one is in flight. The shell asks for a last flush before the app quits.
 */
import type { Storage } from 'redux-persist'

import { desktopBootstrap, invoke } from '~desktop/bridge'
import { appLogger } from './agentObservability'

type KvOp =
  | { op: 'set'; key: string; value: string }
  | { op: 'remove'; key: string }
  | { op: 'clear' }

const values = new Map(Object.entries(desktopBootstrap().kv))
let queued: KvOp[] = []
let inFlight: Promise<void> | undefined

const send = (): Promise<void> => {
  const ops = queued
  queued = []
  inFlight = invoke<void>('kv_apply', { ops })
    .catch(error => {
      // Keep the writes for the next batch rather than lose them.
      queued = [...ops, ...queued]
      appLogger.captureError('startup', 'desktop.kv.write_failed', error)
    })
    .finally(() => {
      inFlight = undefined
      if (queued.length) void send()
    })
  return inFlight
}

const enqueue = (op: KvOp) => {
  queued.push(op)
  if (!inFlight) queueMicrotask(() => !inFlight && queued.length && void send())
}

/** Resolves once every write made so far has reached the shell. */
export const flushStorage = async (): Promise<void> => {
  while (inFlight || queued.length) {
    await (inFlight ?? send())
  }
}

export const storage = {
  set(key: string, value: string | number | boolean) {
    const text = String(value)
    values.set(key, text)
    enqueue({ op: 'set', key, value: text })
  },
  getString: (key: string) => values.get(key),
  getBoolean(key: string) {
    const value = values.get(key)
    return value === undefined ? undefined : value === 'true'
  },
  getNumber(key: string) {
    const value = values.get(key)
    if (value === undefined) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  },
  remove(key: string) {
    values.delete(key)
    enqueue({ op: 'remove', key })
  },
  clearAll() {
    values.clear()
    enqueue({ op: 'clear' })
  },
}

export const mmkvStorage: Storage = {
  setItem: async (key, value) => {
    storage.set(key, value)
    return true
  },
  getItem: async key => storage.getString(key),
  removeItem: async key => storage.remove(key),
}

// A desktop installation never held the mobile app's earlier storage formats.
export const prepareLegacyStorageForLocalMigrations = async () => undefined
