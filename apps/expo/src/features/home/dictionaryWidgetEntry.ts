import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { DictionaryAccess, DictionaryWork } from '~features/resources/dictionaryAccess'
import type { OfflineResourceRegistrySnapshot } from '~features/resources/resourceAvailability'

export const selectDictionaryWidgetWork = (
  language: ResourceLanguage,
  works: readonly DictionaryWork[],
  snapshot: OfflineResourceRegistrySnapshot
): DictionaryWork => {
  const candidates = works.filter(work => work.resource.language === language)
  const defaultWork = language === 'en' ? 'easton-webster' : 'westphal'
  const installed = new Set(
    [...snapshot.resources.values()].flatMap(entry =>
      entry.resource.kind === 'dictionary' &&
      entry.resource.language === language &&
      entry.availability.status === 'available'
        ? [entry.resource.work]
        : []
    )
  )
  return (
    candidates.find(work => work.resource.work === defaultWork && installed.has(defaultWork)) ??
    candidates.find(work => installed.has(work.resource.work)) ??
    candidates.find(work => work.resource.work === defaultWork) ??
    candidates[0]
  )
}

export const loadDictionaryWidgetEntry = async (
  access: Pick<DictionaryAccess, 'listByLetterPage'>,
  language: ResourceLanguage,
  work: string,
  random = Math.random
) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  const start = Math.floor(random() * alphabet.length)
  for (let offset = 0; offset < alphabet.length; offset++) {
    const letter = alphabet[(start + offset) % alphabet.length]
    const { entries } = await access.listByLetterPage(letter, { limit: 100 }, language, work)
    if (entries.length) return entries[Math.floor(random() * entries.length)]
  }
  return null
}
