/**
 * Keeps what a read answered, by key, for a while and for one server instance. The pages
 * rendered while the read is in flight share it instead of each asking again: a new instance
 * meets its first pages together, and would send every one of their reads several times.
 * An answer that is absent, or a read that failed, is not kept.
 */
export const createInstanceCache = <Value>(ttlMs: number) => {
  const entries = new Map<string, { at: number; value: Promise<Value | undefined> }>()

  return (key: string, read: () => Promise<Value | undefined>): Promise<Value | undefined> => {
    const cached = entries.get(key)
    if (cached && Date.now() - cached.at < ttlMs) return cached.value

    const entry = { at: Date.now(), value: read() }
    entries.set(key, entry)
    const forget = () => {
      if (entries.get(key) === entry) entries.delete(key)
    }
    entry.value.then(value => {
      if (value === undefined) forget()
    }, forget)
    return entry.value
  }
}
