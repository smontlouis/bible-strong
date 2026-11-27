// `String.prototype.localeCompare` builds a new collator on every call under Hermes on Android,
// through the platform's ICU locale matching: about 2 ms per call with a locale or options on a
// fast emulator, tens of ms on entry-level phones. Sorting the version catalog took 554 calls and
// kept the JS thread busy long enough to raise ANRs on Android Go devices. A collator is built
// once per locale and options here, then reused.

type CompareOptions = Intl.CollatorOptions

const collators = new Map<string, Intl.Collator | null>()

const getCollator = (locales?: string, options?: CompareOptions): Intl.Collator | null => {
  const key = `${locales ?? ''}|${options ? JSON.stringify(options) : ''}`
  let collator = collators.get(key)
  if (collator === undefined) {
    try {
      collator = new Intl.Collator(locales, options)
    } catch {
      // An unknown locale or a runtime without Intl: the order falls back to code units.
      collator = null
    }
    collators.set(key, collator)
  }
  return collator
}

const compareCodeUnits = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)

/** Same result as `left.localeCompare(right, locales, options)`, without its per-call cost. */
export const compareText = (
  left: string,
  right: string,
  locales?: string,
  options?: CompareOptions
): number => {
  const collator = getCollator(locales, options)
  return collator ? collator.compare(left, right) : compareCodeUnits(left, right)
}
