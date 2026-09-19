import type { PassageTarget } from '@bible-strong/ai-contract/contract'
import type { BibleContentAccess } from '~features/resources/bibleContentAccess'
export function passageKeys(p: PassageTarget) {
  return Array.from(
    { length: p.end - p.start + 1 },
    (_, i) => `${p.book}-${p.chapter}-${p.start + i}`
  )
}
export async function loadWidgetPassage(
  p: PassageTarget,
  access: Pick<BibleContentAccess, 'loadVerseTexts'>,
  signal: AbortSignal
) {
  const keys = passageKeys(p)
  const texts = await access.loadVerseTexts({
    version: p.version,
    verseKeys: keys,
    shouldCancel: () => signal.aborted,
  })
  if (signal.aborted) throw new Error('CANCELLED')
  if (keys.some(key => typeof texts[key] !== 'string' || !texts[key].trim()))
    throw new Error('PASSAGE_UNAVAILABLE')
  return keys.map((key, index) => ({ number: p.start + index, text: texts[key] }))
}
