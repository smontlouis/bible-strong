import { answerShared, notingStaleAnswers, type NotedAnswer } from '../resources/staleAnswers'

/**
 * Keeps what a read answered, by key, for a while and for one server instance. The pages
 * rendered while the read is in flight share it instead of each asking again: a new instance
 * meets its first pages together, and would send every one of their reads several times.
 * An answer that is absent, or a read that failed, is not kept. Nor is a STALE answer of the
 * Resource API: the next page reads again, and so does each page that was sharing the read.
 */
export const createInstanceCache = <Value>(ttlMs: number) => {
  const entries = new Map<string, { at: number; answer: Promise<NotedAnswer<Value | undefined>> }>()

  return (key: string, read: () => Promise<Value | undefined>): Promise<Value | undefined> => {
    const cached = entries.get(key)
    if (cached && Date.now() - cached.at < ttlMs) return answerShared(cached.answer, read)

    const entry = { at: Date.now(), answer: notingStaleAnswers(read) }
    entries.set(key, entry)
    const forget = () => {
      if (entries.get(key) === entry) entries.delete(key)
    }
    entry.answer.then(({ value, stale }) => {
      if (value === undefined || stale) forget()
    }, forget)
    return entry.answer.then(({ value }) => value)
  }
}
