/**
 * A read, and whether the Resource API gave it a STALE answer: one that an earlier version
 * of the API stored, sent at once while the API reads again for the next caller (ADR-0076).
 * Such an answer is nearly always the right one, and is not worth keeping: the next read
 * gets the answer of the current version.
 */
export type NotedAnswer<Value> = { value: Value; stale: boolean }

type Observation = { stale: boolean; parent?: Observation }
type Observations = {
  getStore(): Observation | undefined
  run<Result>(store: Observation, callback: () => Result): Result
}

// What tells the reads of one page from those of the pages rendered beside it. Node gives it
// without an import, and it must be so: the browser loads the modules that read the
// Resource API, though it never reads, and could not load a module of the server.
const asyncHooks =
  typeof process === 'undefined' ? undefined : process.getBuiltinModule?.('node:async_hooks')
const observations: Observations | undefined =
  asyncHooks && new asyncHooks.AsyncLocalStorage<Observation>()

// Every STALE answer this instance was given: what is left to go by where the reads of a
// page cannot be told apart.
let staleAnswers = 0

/** Says that the read being made was given a STALE answer. `readResource` says it. */
export const noteStaleAnswer = (): void => {
  staleAnswers += 1
  // Every read being observed around this one used the answer too.
  for (let observation = observations?.getStore(); observation; observation = observation.parent) {
    observation.stale = true
  }
}

/**
 * Runs a read, of one document or of many, and tells whether a STALE answer came into it.
 * A read that instance memory would keep goes through here: a STALE answer kept for an hour
 * would outlive by far the minute the pages rendered with it are kept.
 */
export const notingStaleAnswers = async <Value>(
  read: () => Promise<Value>
): Promise<NotedAnswer<Value>> => {
  if (!observations) {
    // Any STALE answer given meanwhile counts, to another page too: a read is then taken
    // for STALE more often than it is, and never less.
    const before = staleAnswers
    const value = await read()
    return { value, stale: staleAnswers !== before }
  }
  const observation: Observation = { stale: false, parent: observations.getStore() }
  const value = await observations.run(observation, read)
  return { value, stale: observation.stale }
}

/**
 * Gives one more page the answer of a read it shares with the page that started it. When
 * that answer is a STALE one the page reads for itself instead: only the response of the
 * page whose read it was has been marked, and the Resource API has usually read again by
 * then, so that this page gets the answer of the current version.
 */
export const answerShared = async <Value>(
  answer: Promise<NotedAnswer<Value>>,
  read: () => Promise<Value>
): Promise<Value> => {
  const { value, stale } = await answer
  return stale ? read() : value
}
