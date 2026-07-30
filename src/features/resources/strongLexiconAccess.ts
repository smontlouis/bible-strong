import type { SQLiteDatabase } from '~helpers/sqlite'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongIdentity, StrongIdentityKind } from '~helpers/strongIdentities'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import {
  getStrongLexiconModuleAvailability,
  withOptionalStrongLexiconDatabase,
  withStrongLexiconDatabase,
  type StrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'

export type StrongLexiconMorphology = {
  code: string
  meaning: string
  description?: string
}

export type StrongLexiconRelation = {
  group: 'subentry' | 'identity' | 'family'
  relationKind: string
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
  targetUniqueName?: string
  targetUStrong?: string
  targetCategory?: string
  targetType?: string
  targetName: string
}

export type StrongLexiconEntity = {
  id: number
  uniqueName: string
  uStrong: string
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

const loadMorphologies = async (
  database: SQLiteDatabase,
  codes: string[],
  language: ResourceLanguage
): Promise<StrongLexiconMorphology[]> => {
  const normalizedCodes = [...new Set(codes.map(code => code.trim()).filter(Boolean))]
  if (!normalizedCodes.length) return []

  const placeholders = normalizedCodes.map(() => '?').join(', ')
  const rows = await database.getAllAsync<
    MorphologyRow & { normalizedCode: string; scope: string }
  >(
    `SELECT m.code, m.normalizedCode, m.scope, m.meaning, m.description,
            tr.meaning AS localizedMeaning,
            tr.description AS localizedDescription
       FROM MorphologyCodes m
       LEFT JOIN MorphologyCodeTranslations tr
         ON tr.morphologyCodeId=m.id AND tr.language=?
      WHERE m.code IN (${placeholders}) OR m.normalizedCode IN (${placeholders})
      ORDER BY CASE m.scope
        WHEN 'tagged_full' THEN 0
        WHEN 'lexical_brief' THEN 1
        ELSE 2
      END, m.id`,
    [language, ...normalizedCodes, ...normalizedCodes]
  )

  return normalizedCodes.map(requestedCode => {
    const row = rows.find(
      candidate =>
        candidate.code.toUpperCase() === requestedCode.toUpperCase() ||
        candidate.normalizedCode.toUpperCase() === requestedCode.toUpperCase()
    )
    if (!row) return { code: requestedCode, meaning: requestedCode }

    const meaning = chooseLocalized(language, row.localizedMeaning, row.meaning)
    const description = chooseLocalized(language, row.localizedDescription, row.description)
    return {
      code: requestedCode,
      meaning,
      ...(normalizeText(description) !== normalizeText(meaning) && description
        ? { description }
        : {}),
    }
  })
}

const loadRelations = async (
  database: SQLiteDatabase,
  entryId: number,
  language: ResourceLanguage
): Promise<StrongLexiconRelation[]> => {
  const rows = await database.getAllAsync<{
    groupKind: 'subentry' | 'identity' | 'family'
    relationKind: string
    labelEn: string
    labelFr: string
    stepCode: string
    gloss: string
    localizedGloss: string | null
    original: string
    transliteration: string
    classicTransliteration: string
  }>(
    `SELECT r.groupKind, k.kind AS relationKind, k.labelEn, k.labelFr,
            r.toStepCode AS stepCode,
            target.gloss, tr.gloss AS localizedGloss,
            target.original, target.transliteration, target.classicTransliteration
       FROM LexiconRelations r
       JOIN RelationKinds k ON k.id=r.relationKindId
       LEFT JOIN StepEntries target ON target.id=r.toStepEntryId
       LEFT JOIN LexiconTranslations tr
         ON tr.stepEntryId=target.id AND tr.language=?
      WHERE r.fromStepEntryId=?
      ORDER BY r.groupKind, r.sortOrder`,
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
        relationKind: row.relationKind,
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

type EntityRow = {
  id: number
  uniqueName: string
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
}

const hydrateEntity = async (
  database: SQLiteDatabase,
  entity: EntityRow,
  language: ResourceLanguage
): Promise<StrongLexiconEntity> => {
  const [place, relations] = await Promise.all([
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
      targetUniqueName: string | null
      targetUStrong: string | null
      targetCategory: string | null
      targetType: string | null
      targetName: string | null
      localizedTargetName: string | null
      toUniqueName: string
    }>(
      `SELECT r.relation, r.certainty, r.toEntityId, r.toUniqueName,
              target.uniqueName AS targetUniqueName,
              target.uStrong AS targetUStrong,
              target.category AS targetCategory,
              target.type AS targetType,
              target.displayName AS targetName,
              tr.displayName AS localizedTargetName
         FROM EntityRelations r
         LEFT JOIN Entities target ON target.id=r.toEntityId
         LEFT JOIN EntityTranslations tr ON tr.entityId=target.id AND tr.language=?
        WHERE r.fromEntityId=?
        ORDER BY r.relation, target.displayName
        LIMIT 60`,
      [language, entity.id]
    ),
  ])

  return {
    id: entity.id,
    uniqueName: entity.uniqueName,
    uStrong: entity.uStrong,
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
      ...(relation.targetUniqueName || relation.toUniqueName
        ? { targetUniqueName: relation.targetUniqueName || relation.toUniqueName }
        : {}),
      ...(relation.targetUStrong ? { targetUStrong: relation.targetUStrong } : {}),
      ...(relation.targetCategory ? { targetCategory: relation.targetCategory } : {}),
      ...(relation.targetType ? { targetType: relation.targetType } : {}),
      targetName:
        chooseLocalized(language, relation.localizedTargetName, relation.targetName ?? '') ||
        relation.toUniqueName,
    })),
  }
}

const loadEntityForEntry = async (
  database: SQLiteDatabase | null,
  row: CoreEntryRow,
  language: ResourceLanguage
): Promise<StrongLexiconEntity | undefined> => {
  if (!database) return undefined
  const entity = await database.getFirstAsync<EntityRow>(
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

  return hydrateEntity(database, entity, language)
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
  const [morphology, relations] = await Promise.all([
    loadMorphology(core, row, language),
    includeExtended ? loadRelations(core, row.id, language) : Promise.resolve([]),
  ])
  const [resourceResult, entity] = await Promise.all([
    includeExtended && resourcesAvailability.status === 'available'
      ? withOptionalStrongLexiconDatabase('resources', database =>
          loadResources(database, row.id, language)
        ).then(result => result ?? { resources: [], lsjAbsent: false })
      : Promise.resolve({ resources: [], lsjAbsent: false }),
    includeExtended && entitiesAvailability.status === 'available'
      ? withOptionalStrongLexiconDatabase('entities', database =>
          loadEntityForEntry(database, row, language)
        ).then(result => result ?? undefined)
      : Promise.resolve(undefined),
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
  loadMorphologies: (
    codes: string[],
    language: ResourceLanguage
  ) => Promise<StrongLexiconMorphology[]>
  loadEntity: (
    uniqueName: string,
    language: ResourceLanguage
  ) => Promise<StrongLexiconEntity | undefined>
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
    return withStrongLexiconDatabase('core', async core => {
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
    })
  },

  async loadEntity(uniqueName, language) {
    const availability = await getStrongLexiconModuleAvailability('entities')
    if (availability.status !== 'available') return undefined
    const entity = await withOptionalStrongLexiconDatabase('entities', async database => {
      const row = await database.getFirstAsync<EntityRow>(
        `SELECT e.*,
              tr.displayName AS localizedDisplayName,
              tr.description AS localizedDescription,
              tr.shortDescription AS localizedShortDescription,
              tr.summaryHtml AS localizedSummaryHtml,
              tr.brief AS localizedBrief,
              tr.articleHtml AS localizedArticleHtml
         FROM Entities e
         LEFT JOIN EntityTranslations tr ON tr.entityId=e.id AND tr.language=?
        WHERE e.uniqueName=?
        LIMIT 1`,
        [language, uniqueName]
      )
      return row ? hydrateEntity(database, row, language) : undefined
    })
    return entity ?? undefined
  },

  async loadEntry(identity, language) {
    return withStrongLexiconDatabase('core', async core => {
      const row = await resolveCoreEntry(core, identity, language)
      return row ? toEntry(core, row, identity, language, true) : undefined
    })
  },

  async loadEntries(identities, language) {
    const entries = await Promise.all(
      identities.map(identity => localStrongLexiconAccess.loadEntry(identity, language))
    )
    return entries.filter((entry): entry is StrongLexiconEntry => Boolean(entry))
  },

  async loadMorphologies(codes, language) {
    return withStrongLexiconDatabase('core', core => loadMorphologies(core, codes, language))
  },

  async search(query, language, limit = 100) {
    const normalized = query.trim()
    const like = `%${normalized}%`
    return withStrongLexiconDatabase('core', async core => {
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
    })
  },

  async browseByGlossPrefix(prefix, language, limit = 500) {
    const normalizedPrefix = prefix.trim()
    if (!normalizedPrefix) return []
    return withStrongLexiconDatabase('core', async core => {
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
    })
  },

  async random(lexicalLanguage, language) {
    return withStrongLexiconDatabase('core', async core => {
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
    })
  },
}
