import { useAtom } from 'jotai'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { getReserveEntryKey, type DailyCollection } from './dailyReadingFormat'

const KEPT_DAYS = 7

/**
 * The verse a reader chose with « Changer de verset », by date: the day keeps it, the home card
 * and the meditation show the same one, and the following days return to their own verse.
 * `shown` lists every verse already offered that day, so that a second change offers a new one.
 */
const verseSwapsAtom = atomWithAsyncStorage<Record<string, { key: string; shown: string[] }>>(
  'dailyVerseSwaps',
  {}
)

export const useVerseSwap = (collection: DailyCollection | undefined, date: string) => {
  const [swaps, setSwaps] = useAtom(verseSwapsAtom)
  const swap = swaps[date]
  const change = (currentKey: string | undefined) => {
    if (!collection) return
    const shown = [...(swap?.shown ?? []), ...(currentKey ? [currentKey] : [])]
    const next = getReserveEntryKey(collection, date, shown)
    if (!next) return
    const kept = Object.entries(swaps)
      .filter(([day]) => day !== date)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, KEPT_DAYS - 1)
    setSwaps(Object.fromEntries([...kept, [date, { key: next, shown }]]))
  }
  return { swappedKey: swap?.key, change }
}
