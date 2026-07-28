import type { SQLiteDatabase } from '~helpers/sqlite'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongIdentity, StrongIdentityKind } from '~helpers/strongIdentities'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import {
  getOptionalStrongLexiconDatabase,
  getStrongLexiconDatabase,
  getStrongLexiconModuleAvailability,
  type StrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'

export type StrongLexiconMorphology = {
  code: string
  meaning: string
  description?: string
}

export type StrongLexiconRelation = {
  group: 'subentry' | 'identity' | 'family'
  label: string
  stepCode: string
  gloss: string
  original: string
  transliteration: string
}

export type StrongLexiconResource = {
  id: number
  source: string
  kind: string
  title: string
  contentHtml: string
}

export type StrongLexiconEntityRelation = {
  relation: string
  certainty: string
  targetId?: number
  targetName: string
}

export type StrongLexiconEntity = {
  id: number
  name: string
  category: string
  type: string
  description: string
  shortDescription: string
  summaryHtml: string
  brief: string
  articleHtml: string
  matchedStrong: string
  place?: {
    name: string
    area: string
    latitude?: number
    longitude?: number
    googleMapUrl?: string
    palopenmapsUrl?: string
  }
  relations: StrongLexiconEntityRelation[]
  references: string[]
  hiddenReferenceCount: number
}

export type StrongLexiconEntry = {
  id: number
  selectedIdentity: StrongIdentity
  stepCode: string
  classicStrong: string
  eStrong: string
  dStrong: string
  uStrong: string
  language: 'greek' | 'hebrew'
  baseCode: number
  original: string
  transliteration: string
  pronunciation?: string
  gloss: string
  definitionHtml?: string
  morphology?: StrongLexiconMorphology
  relations: StrongLexiconRelation[]
  resources: StrongLexiconResource[]
  lsjAbsent: boolean
  entity?: StrongLexiconEntity
  modules: {
    resources: StrongLexiconModuleAvailability
    entities: StrongLexiconModuleAvailability
  }
}

export type StrongLexiconPreview = Pick<
  StrongLexiconEntry,
  | 'id'
  | 'selectedIdentity'
  | 'stepCode'
  | 'classicStrong'
  | 'language'
  | 'original'
  | 'transliteration'
  | 'gloss'
  | 'definitionHtml'
>

export type StrongLexiconSearchResult = {
  id: number
  stepCode: string
  classicStrong: string
  language: 'greek' | 'hebrew'
  original: string
  transliteration: string
  gloss: string
}

type CoreEntryRow = {
  id: number
  language: 'greek' | 'hebrew'
  baseCode: number
  eStrong: string
  dStrong: string
  uStrong: string
  original: string
  transliteration: string
  morph: string
  gloss: string
  meaning: string
  classicTransliteration: string
  pronunciation: string
  stepCode: string
  localizedGloss: string | null
  localizedMeaning: string | null
  localizedMeaningHtml: string | null
}

type MorphologyRow = {
  code: string
  meaning: string
  description: string
  localizedMeaning: string | null
  localizedDescription: string | null
}

const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()

const inferLanguage = (code: string): 'greek' | 'hebrew' =>
  code.trim().toUpperCase().startsWith('G') ? 'greek' : 'hebrew'

const getBaseCode = (code: string): number | undefined => {
  const match = code
    .trim()
    .toUpperCase()
    .match(/^[HG]0*(\d+)/u)
  if (!match) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) ? value : undefined
}

const getClassicStrong = (row: CoreEntryRow): string =>
  `${row.language === 'greek' ? 'G' : 'H'}${String(row.baseCode).padStart(4, '0')}`

const chooseLocalized = (
  language: ResourceLanguage,
  localized: string | null,
  fallback: string
): string => (language === 'fr' && localized?.trim() ? localized : fallback)

const resolveCoreEntry = async (
  database: SQLiteDatabase,
  identity: StrongIdentity,
  language: ResourceLanguage
): Promise<CoreEntryRow | null> => {
  const code = identity.code.trim().toUpperCase()
  const baseCode = getBaseCode(code)
  const lexicalLanguage = inferLanguage(code)
  const sharedSelect = `
    SELECT e.*, i.stepCode,
           tr.gloss AS localizedGloss,
           tr.meaning AS localizedMeaning,
           tr.meaningHtml AS localizedMeaningHtml
      FROM StepEntries e
      JOIN StepEntryIdentities i ON i.stepEntryId=e.id
      LEFT JOIN LexiconTranslations tr
        ON tr.stepEntryId=e.id AND tr.language=?`
  const parameters: (string | number)[] = [language]
  let where: string

  if (identity.kind === 'dstrong') {
    where = 'i.stepCode=? OR e.dStrong=?'
    parameters.push(code, code)
  } else if (identity.kind === 'estrong') {
    where = 'i.stepCode=? OR e.eStrong=?'
    parameters.push(code, code)
  } else if (identity.kind === 'ustrong') {
    where = 'e.uStrong=?'
    parameters.push(code)
  } else {
    where = baseCode == null ? 'i.stepCode=?' : 'i.stepCode=? OR (e.language=? AND e.baseCode=?)'
    parameters.push(code)
    if (baseCode != null) parameters.push(lexicalLanguage, baseCode)
  }

  const direct = await database.getFirstAsync<CoreEntryRow>(
    `${sharedSelect} WHERE ${where}
      ORDER BY CASE WHEN i.stepCode=? THEN 0 ELSE 1 END, e.id
      LIMIT 1`,
    [...parameters, code]
  )
  if (direct) return direct

  return database.getFirstAsync<CoreEntryRow>(
    `${sharedSelect}
      WHERE e.uStrong=? OR e.eStrong=? OR (e.language=? AND e.baseCode=?)
      ORDER BY CASE
        WHEN e.uStrong=? THEN 0
        WHEN e.eStrong=? THEN 1
        ELSE 2
      END, e.id
      LIMIT 1`,
    [language, code, code, lexicalLanguage, baseCode ?? -1, code, code]
  )
}

const loadMorphology = async (
  database: SQLiteDatabase,
  row: CoreEntryRow,
  language: ResourceLanguage
): Promise<StrongLexiconMorphology | undefined> => {
  if (!row.morph.trim()) return undefined
  const morphology = await database.getFirstAsync<MorphologyRow>(
    `SELECT m.code, m.meaning, m.description,
            tr.meaning AS localizedMeaning,
            tr.description AS localizedDescription
       FROM MorphologyCodes m
       LEFT JOIN MorphologyCodeTranslations tr
         ON tr.morphologyCodeId=m.id AND tr.language=?
      WHERE m.scope='lexical_brief' AND (m.code=? OR m.normalizedCode=?)
      ORDER BY CASE WHEN m.code=? THEN 0 ELSE 1 END, m.id
      LIMIT 1`,
    [language, row.morph, row.morph, row.morph]
  )
  if (!morphology) return { code: row.morph, meaning: row.morph }
  const meaning = chooseLocalized(language, morphology.localizedMeaning, morphology.meaning)
  const description = chooseLocalized(
    language,
    morphology.localizedDescription,
    morphology.description
  )
  return {
    code: row.morph,
    meaning,
    ...(normalizeText(description) !== normalizeText(meaning) && description
      ? { description }
      : {}),
  }
}

const loadRelations = async (
  database: SQLiteDatabase,
  entryId: number,
  language: ResourceLanguage
): Promise<StrongLexiconRelation[]> => {
  const rows = await database.getAllAsync<{
    groupKind: 'subentry' | 'identity' | 'family'
    labelEn: string
    labelFr: string
    stepCode: string
    gloss: string
    localizedGloss: string | null
    original: string
    transliteration: string
    classicTransliteration: string
  }>(
    `SELECT r.groupKind, k.labelEn, k.labelFr,
            r.toStepCode AS stepCode,
            target.gloss, tr.gloss AS localizedGloss,
            target.original, target.transliteration, target.classicTransliteration
       FROM LexiconRelations r
       JOIN RelationKinds k ON k.id=r.relationKindId
       LEFT JOIN StepEntries target ON target.id=r.toStepEntryId
       LEFT JOIN LexiconTranslations tr
         ON tr.stepEntryId=target.id AND tr.language=?
      WHERE r.fromStepEntryId=?
      ORDER BY r.groupKind, r.sortOrder
      LIMIT 72`,
    [language, entryId]
  )
  const counts = new Map<string, number>()
  return rows.flatMap(row => {
    const count = counts.get(row.groupKind) ?? 0
    if (count >= 24) return []
    counts.set(row.groupKind, count + 1)
    return [
      {
        group: row.groupKind,
        label: language === 'fr' ? row.labelFr || row.labelEn : row.labelEn,
        stepCode: row.stepCode,
        gloss: chooseLocalized(language, row.localizedGloss, row.gloss),
        original: row.original ?? '',
        transliteration: row.classicTransliteration || row.transliteration || '',
      },
    ]
  })
}

const loadResources = async (
  database: SQLiteDatabase | null,
  entryId: number,
  language: ResourceLanguage
): Promise<{ resources: StrongLexiconResource[]; lsjAbsent: boolean }> => {
  if (!database) return { resources: [], lsjAbsent: false }
  const rows = await database.getAllAsync<{
    id: number
    source: string
    kind: string
    contentHtml: string
    localizedContentHtml: string | null
  }>(
    `SELECT r.id, r.source, r.kind, r.contentHtml,
            tr.contentHtml AS localizedContentHtml
       FROM LexiconResources r
       LEFT JOIN LexiconResourceTranslations tr
         ON tr.resourceId=r.id AND tr.language=?
      WHERE r.stepEntryId=?
      ORDER BY r.id
      LIMIT 5`,
    [language, entryId]
  )
  let lsjAbsent = false
  const resources = rows.flatMap(row => {
    const contentHtml = chooseLocalized(language, row.localizedContentHtml, row.contentHtml)
    if (/LSJ (?:has|ne possède) no entry|Le LSJ ne contient aucune entrée/iu.test(contentHtml)) {
      lsjAbsent = true
      return []
    }
    return [
      {
        id: row.id,
        source: row.source,
        kind: row.kind,
        title:
          row.source === 'TFLSJ'
            ? language === 'fr'
              ? 'Dictionnaire grec détaillé'
              : 'Detailed Greek dictionary'
            : language === 'fr'
              ? 'Notice complémentaire'
              : 'Additional resource',
        contentHtml,
      },
    ]
  })
  return { resources, lsjAbsent }
}

const loadEntity = async (
  database: SQLiteDatabase | null,
  row: CoreEntryRow,
  language: ResourceLanguage
): Promise<StrongLexiconEntity | undefined> => {
  if (!database) return undefined
  const entity = await database.getFirstAsync<{
    id: number
    uStrong: string
    displayName: string
    category: string
    type: string
    description: string
    shortDescription: string
    summaryHtml: string
    brief: string
    articleHtml: string
    localizedDisplayName: string | null
    localizedDescription: string | null
    localizedShortDescription: string | null
    localizedSummaryHtml: string | null
    localizedBrief: string | null
    localizedArticleHtml: string | null
  }>(
    `SELECT e.*,
            tr.displayName AS localizedDisplayName,
            tr.description AS localizedDescription,
            tr.shortDescription AS localizedShortDescription,
            tr.summaryHtml AS localizedSummaryHtml,
            tr.brief AS localizedBrief,
            tr.articleHtml AS localizedArticleHtml
       FROM Entities e
       LEFT JOIN EntityTranslations tr ON tr.entityId=e.id AND tr.language=?
      WHERE e.uStrong=? OR e.uStrong=?
         OR (substr(e.uStrong, 1, 1)=? AND CAST(substr(e.uStrong, 2, 4) AS INTEGER)=?
             AND lower(e.displayName)=lower(?))
      ORDER BY CASE WHEN e.uStrong=? THEN 0 WHEN e.uStrong=? THEN 1 ELSE 2 END, e.id
      LIMIT 1`,
    [
      language,
      row.uStrong,
      row.eStrong,
      row.language === 'greek' ? 'G' : 'H',
      row.baseCode,
      row.gloss,
      row.uStrong,
      row.eStrong,
    ]
  )
  if (!entity) return undefined

  const [place, relations, references, referenceCount] = await Promise.all([
    database.getFirstAsync<{
      openBibleName: string
      area: string
      latitude: number | null
      longitude: number | null
      googleMapUrl: string
      palopenmapsUrl: string
    }>('SELECT * FROM EntityPlaces WHERE entityId=?', [entity.id]),
    database.getAllAsync<{
      relation: string
      certainty: string
      toEntityId: number | null
      targetName: string | null
      localizedTargetName: string | null
      toUniqueName: string
    }>(
      `SELECT r.relation, r.certainty, r.toEntityId, r.toUniqueName,
              target.displayName AS targetName,
              tr.displayName AS localizedTargetName
         FROM EntityRelations r
         LEFT JOIN Entities target ON target.id=r.toEntityId
         LEFT JOIN EntityTranslations tr ON tr.entityId=target.id AND tr.language=?
        WHERE r.fromEntityId=?
        ORDER BY r.relation, target.displayName
        LIMIT 20`,
      [language, entity.id]
    ),
    database.getAllAsync<{ refText: string }>(
      `SELECT refText FROM EntityRefs
        WHERE entityId=?
        ORDER BY book, chapter, verse, suffix
        LIMIT 30`,
      [entity.id]
    ),
    database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM EntityRefs WHERE entityId=?',
      [entity.id]
    ),
  ])

  return {
    id: entity.id,
    name: chooseLocalized(language, entity.localizedDisplayName, entity.displayName),
    category: entity.category,
    type: entity.type,
    description: chooseLocalized(language, entity.localizedDescription, entity.description),
    shortDescription: chooseLocalized(
      language,
      entity.localizedShortDescription,
      entity.shortDescription
    ),
    summaryHtml: chooseLocalized(language, entity.localizedSummaryHtml, entity.summaryHtml),
    brief: chooseLocalized(language, entity.localizedBrief, entity.brief),
    articleHtml: chooseLocalized(language, entity.localizedArticleHtml, entity.articleHtml),
    matchedStrong: entity.uStrong,
    ...(place
      ? {
          place: {
            name: place.openBibleName,
            area: place.area,
            ...(place.latitude == null ? {} : { latitude: place.latitude }),
            ...(place.longitude == null ? {} : { longitude: place.longitude }),
            ...(place.googleMapUrl ? { googleMapUrl: place.googleMapUrl } : {}),
            ...(place.palopenmapsUrl ? { palopenmapsUrl: place.palopenmapsUrl } : {}),
          },
        }
      : {}),
    relations: relations.map(relation => ({
      relation: relation.relation,
      certainty: relation.certainty,
      ...(relation.toEntityId == null ? {} : { targetId: relation.toEntityId }),
      targetName:
        chooseLocalized(language, relation.localizedTargetName, relation.targetName ?? '') ||
        relation.toUniqueName,
    })),
    references: references.map(reference => reference.refText),
    hiddenReferenceCount: Math.max(0, Number(referenceCount?.count ?? 0) - 30),
  }
}

const toEntry = async (
  core: SQLiteDatabase,
  row: CoreEntryRow,
  identity: StrongIdentity,
  language: ResourceLanguage,
  includeExtended: boolean
): Promise<StrongLexiconEntry> => {
  const [resourcesAvailability, entitiesAvailability] = await Promise.all([
    getStrongLexiconModuleAvailability('resources'),
    getStrongLexiconModuleAvailability('entities'),
  ])
  const [morphology, relations, resourcesDatabase, entitiesDatabase] = await Promise.all([
    loadMorphology(core, row, language),
    includeExtended ? loadRelations(core, row.id, language) : Promise.resolve([]),
    includeExtended && resourcesAvailability.status === 'available'
      ? getOptionalStrongLexiconDatabase('resources')
      : Promise.resolve(null),
    includeExtended && entitiesAvailability.status === 'available'
      ? getOptionalStrongLexiconDatabase('entities')
      : Promise.resolve(null),
  ])
  const [resourceResult, entity] = await Promise.all([
    includeExtended
      ? loadResources(resourcesDatabase, row.id, language)
      : Promise.resolve({ resources: [], lsjAbsent: false }),
    includeExtended ? loadEntity(entitiesDatabase, row, language) : Promise.resolve(undefined),
  ])
  const definitionHtml =
    language === 'fr'
      ? row.localizedMeaningHtml || row.localizedMeaning || undefined
      : row.meaning || undefined
  return {
    id: row.id,
    selectedIdentity: identity,
    stepCode: row.stepCode || row.dStrong || row.eStrong,
    classicStrong: getClassicStrong(row),
    eStrong: row.eStrong,
    dStrong: row.dStrong,
    uStrong: row.uStrong,
    language: row.language,
    baseCode: row.baseCode,
    original: row.original,
    transliteration: row.classicTransliteration || row.transliteration,
    ...(row.pronunciation ? { pronunciation: row.pronunciation } : {}),
    gloss: chooseLocalized(language, row.localizedGloss, row.gloss),
    ...(definitionHtml ? { definitionHtml } : {}),
    ...(morphology ? { morphology } : {}),
    relations,
    resources: resourceResult.resources,
    lsjAbsent: resourceResult.lsjAbsent,
    ...(entity ? { entity } : {}),
    modules: {
      resources: resourcesAvailability,
      entities: entitiesAvailability,
    },
  }
}

export type StrongLexiconAccess = {
  getModuleAvailability: (
    moduleId: StrongLexiconModuleId
  ) => Promise<StrongLexiconModuleAvailability>
  loadPreview: (
    identities: StrongIdentity[],
    language: ResourceLanguage
  ) => Promise<StrongLexiconPreview[]>
  loadEntry: (
    identity: StrongIdentity,
    language: ResourceLanguage
  ) => Promise<StrongLexiconEntry | undefined>
  loadEntries: (
    identities: StrongIdentity[],
    language: ResourceLanguage
  ) => Promise<StrongLexiconEntry[]>
  search: (
    query: string,
    language: ResourceLanguage,
    limit?: number
  ) => Promise<StrongLexiconSearchResult[]>
  browseByGlossPrefix: (
    prefix: string,
    language: ResourceLanguage,
    limit?: number
  ) => Promise<StrongLexiconSearchResult[]>
  random: (
    lexicalLanguage: 'greek' | 'hebrew',
    language: ResourceLanguage
  ) => Promise<StrongLexiconSearchResult | undefined>
}

const toSearchResult = (
  row: Pick<
    CoreEntryRow,
    | 'id'
    | 'stepCode'
    | 'language'
    | 'baseCode'
    | 'original'
    | 'classicTransliteration'
    | 'transliteration'
    | 'gloss'
    | 'localizedGloss'
  >,
  language: ResourceLanguage
): StrongLexiconSearchResult => ({
  id: row.id,
  stepCode: row.stepCode,
  classicStrong: getClassicStrong(row as CoreEntryRow),
  language: row.language,
  original: row.original,
  transliteration: row.classicTransliteration || row.transliteration,
  gloss: chooseLocalized(language, row.localizedGloss, row.gloss),
})

export const localStrongLexiconAccess: StrongLexiconAccess = {
  getModuleAvailability: getStrongLexiconModuleAvailability,

  async loadPreview(identities, language) {
    const core = await getStrongLexiconDatabase('core')
    const candidates = identities
      .filter(identity => identity.kind !== 'ustrong')
      .sort((left, right) => {
        const priority: Record<StrongIdentityKind, number> = {
          dstrong: 0,
          estrong: 1,
          strong: 2,
          ustrong: 3,
        }
        return priority[left.kind] - priority[right.kind]
      })
    const seenEntries = new Set<number>()
    const previews: StrongLexiconPreview[] = []
    for (const identity of candidates) {
      const row = await resolveCoreEntry(core, identity, language)
      if (!row || seenEntries.has(row.id)) continue
      seenEntries.add(row.id)
      const entry = await toEntry(core, row, identity, language, false)
      previews.push({
        id: entry.id,
        selectedIdentity: entry.selectedIdentity,
        stepCode: entry.stepCode,
        classicStrong: entry.classicStrong,
        language: entry.language,
        original: entry.original,
        transliteration: entry.transliteration,
        gloss: entry.gloss,
        definitionHtml: entry.definitionHtml,
      })
    }
    return previews
  },

  async loadEntry(identity, language) {
    const core = await getStrongLexiconDatabase('core')
    const row = await resolveCoreEntry(core, identity, language)
    return row ? toEntry(core, row, identity, language, true) : undefined
  },

  async loadEntries(identities, language) {
    const entries = await Promise.all(
      identities.map(identity => localStrongLexiconAccess.loadEntry(identity, language))
    )
    return entries.filter((entry): entry is StrongLexiconEntry => Boolean(entry))
  },

  async search(query, language, limit = 100) {
    const core = await getStrongLexiconDatabase('core')
    const normalized = query.trim()
    const like = `%${normalized}%`
    const rows = await core.getAllAsync<CoreEntryRow>(
      `SELECT e.*, i.stepCode,
              tr.gloss AS localizedGloss,
              tr.meaning AS localizedMeaning,
              tr.meaningHtml AS localizedMeaningHtml
         FROM StepEntries e
         JOIN StepEntryIdentities i ON i.stepEntryId=e.id
         LEFT JOIN LexiconTranslations tr
           ON tr.stepEntryId=e.id AND tr.language=?
        WHERE i.stepCode LIKE ? OR e.eStrong LIKE ? OR e.dStrong LIKE ?
           OR e.original LIKE ? OR e.transliteration LIKE ?
           OR e.gloss LIKE ? OR tr.gloss LIKE ?
        ORDER BY COALESCE(NULLIF(tr.gloss, ''), e.gloss), e.baseCode
        LIMIT ?`,
      [language, like, like, like, like, like, like, like, limit]
    )
    return rows.map(row => toSearchResult(row, language))
  },

  async browseByGlossPrefix(prefix, language, limit = 500) {
    const normalizedPrefix = prefix.trim()
    if (!normalizedPrefix) return []
    const core = await getStrongLexiconDatabase('core')
    const rows = await core.getAllAsync<CoreEntryRow>(
      `SELECT e.*, i.stepCode,
              tr.gloss AS localizedGloss,
              tr.meaning AS localizedMeaning,
              tr.meaningHtml AS localizedMeaningHtml
         FROM StepEntries e
         JOIN StepEntryIdentities i ON i.stepEntryId=e.id
         LEFT JOIN LexiconTranslations tr
           ON tr.stepEntryId=e.id AND tr.language=?
        WHERE COALESCE(NULLIF(tr.gloss, ''), e.gloss) LIKE ?
        ORDER BY COALESCE(NULLIF(tr.gloss, ''), e.gloss), e.baseCode
        LIMIT ?`,
      [language, `${normalizedPrefix}%`, limit]
    )
    return rows.map(row => toSearchResult(row, language))
  },

  async random(lexicalLanguage, language) {
    const core = await getStrongLexiconDatabase('core')
    const row = await core.getFirstAsync<CoreEntryRow>(
      `SELECT e.*, i.stepCode,
              tr.gloss AS localizedGloss,
              tr.meaning AS localizedMeaning,
              tr.meaningHtml AS localizedMeaningHtml
         FROM StepEntries e
         JOIN StepEntryIdentities i ON i.stepEntryId=e.id
         LEFT JOIN LexiconTranslations tr
           ON tr.stepEntryId=e.id AND tr.language=?
        WHERE e.language=? AND e.gloss <> ''
        ORDER BY RANDOM()
        LIMIT 1`,
      [language, lexicalLanguage]
    )
    return row ? toSearchResult(row, language) : undefined
  },
}
