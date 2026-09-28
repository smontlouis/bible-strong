import type { StrongLexiconEntry } from '@bible-strong/resource-domain/strong-lexicon'
import type { StrongLexiconAccess } from './strongLexiconAccess'
import { ResourceAccessError } from './resourceAccessError'
import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'

export async function getPrimaryStrongLexiconAvailability(
  access: StrongLexiconAccess,
  language: 'fr' | 'en'
) {
  const simple = await access.getModuleAvailability(getSimpleStrongModuleId(language))
  if (simple.status === 'available') return simple
  const detailed = await access.getModuleAvailability('core')
  return detailed.status === 'available' ? detailed : simple
}

const optional = async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ResourceAccessError) return undefined
    throw error
  }
}

export const mergeStrongDefinitionLevels = (
  simple: StrongLexiconEntry | undefined,
  detailed: StrongLexiconEntry | undefined
): StrongLexiconEntry | undefined => {
  const entry = detailed ?? simple
  if (!entry) return undefined
  return {
    ...entry,
    definitionHtml: simple?.definitionHtml,
    detailedDefinitionHtml: detailed?.definitionHtml,
  }
}

/** Select each level independently: downloading the simple lexicon never requires STEP. */
export function createLayeredStrongLexiconAccess(
  simple: StrongLexiconAccess,
  detailed: StrongLexiconAccess
): StrongLexiconAccess {
  const preferSimple = async <T>(first: () => Promise<T>, fallback: () => Promise<T>) => {
    try {
      return await first()
    } catch (error) {
      if (!(error instanceof ResourceAccessError)) throw error
      return fallback()
    }
  }
  const access: StrongLexiconAccess = {
    ...detailed,
    async loadEntry(identity, language) {
      const [basic, advanced] = await Promise.all([
        optional(() => simple.loadEntry(identity, language)),
        optional(() => detailed.loadEntry(identity, language)),
      ])
      const merged = mergeStrongDefinitionLevels(basic, advanced)
      if (merged) return merged
      // Preserve the normal recovery error if neither resource can be read.
      return simple.loadEntry(identity, language)
    },
    async loadEntries(identities, language) {
      const entries = await Promise.all(
        identities.map(identity => access.loadEntry(identity, language))
      )
      return entries.filter((entry): entry is StrongLexiconEntry => Boolean(entry))
    },
    async loadEntryCards(identities, language) {
      return preferSimple(
        () => simple.loadEntryCards(identities, language),
        async () =>
          (await detailed.loadEntryCards(identities, language)).map(entry => ({
            ...entry,
            definitionHtml: undefined,
          }))
      )
    },
    async loadPreview(identities, language) {
      return access.loadEntryCards(identities, language)
    },
    listEntries: request =>
      preferSimple(
        () => simple.listEntries(request),
        () => detailed.listEntries(request)
      ),
    search: (query, language, limit) =>
      preferSimple(
        () => simple.search(query, language, limit),
        () => detailed.search(query, language, limit)
      ),
    browseByGlossPrefix: (prefix, language, limit) =>
      preferSimple(
        () => simple.browseByGlossPrefix(prefix, language, limit),
        () => detailed.browseByGlossPrefix(prefix, language, limit)
      ),
    random: (lexicalLanguage, language) =>
      preferSimple(
        () => simple.random(lexicalLanguage, language),
        () => detailed.random(lexicalLanguage, language)
      ),
    loadMorphologies: (codes, language) =>
      preferSimple(
        () => simple.loadMorphologies(codes, language),
        () => detailed.loadMorphologies(codes, language)
      ),
  }
  return access
}
