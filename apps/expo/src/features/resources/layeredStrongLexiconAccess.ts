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

// Previews contain the definition to display, while full entries retain both levels.
// Match exact STEP identities, never numeric IDs from independent publications.
const loadCardsWithDefinitionFallback = async <
  T extends { stepCode: string; language: string; definitionHtml?: string },
>(
  loadSimple: () => Promise<T[]>,
  loadDetailed: () => Promise<T[]>
): Promise<T[]> => {
  const basic = await optional(loadSimple)
  if (!basic) return loadDetailed()
  if (basic.every(entry => entry.definitionHtml?.trim())) return basic
  const detailed = await optional(loadDetailed)
  if (!detailed) return basic
  return basic.map(entry => {
    if (entry.definitionHtml?.trim()) return entry
    const replacement = detailed.find(
      candidate => candidate.stepCode === entry.stepCode && candidate.language === entry.language
    )
    return replacement?.definitionHtml
      ? { ...entry, definitionHtml: replacement.definitionHtml }
      : entry
  })
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
    async loadEntry(identity, language, options) {
      const [basic, advanced] = await Promise.all([
        optional(() => simple.loadEntry(identity, language, options)),
        optional(() => detailed.loadEntry(identity, language, options)),
      ])
      const merged = mergeStrongDefinitionLevels(basic, advanced)
      if (merged)
        return options?.content === 'definitions'
          ? { ...merged, detailedEntryAvailable: Boolean(advanced) }
          : merged
      // Preserve the normal recovery error if neither resource can be read.
      return simple.loadEntry(identity, language, options)
    },
    async loadEntryExtras(identity, language) {
      // The historical text has already been read. Only enrich the detailed entry;
      // never replace the definitions or identity used by the initial presentation.
      const entry = await detailed.loadEntry(identity, language)
      if (!entry) return null
      const { resources, lsjAbsent, entity, modules } = entry
      return { resources, lsjAbsent, entity, modules }
    },
    async loadEntries(identities, language) {
      const entries = await Promise.all(
        identities.map(identity => access.loadEntry(identity, language))
      )
      return entries.filter((entry): entry is StrongLexiconEntry => Boolean(entry))
    },
    async loadEntryCards(identities, language) {
      return loadCardsWithDefinitionFallback(
        () => simple.loadEntryCards(identities, language),
        () => detailed.loadEntryCards(identities, language)
      )
    },
    async loadPreview(identities, language) {
      return loadCardsWithDefinitionFallback(
        () => simple.loadPreview(identities, language),
        () => detailed.loadPreview(identities, language)
      )
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
