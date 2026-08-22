import type { SQLiteDatabase } from '~helpers/sqlite'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { Schema } from 'effect'
import {
  createStrongIdentity,
  getDisplayedStrongIdentities,
  type StrongIdentity,
  type StrongIdentityKind,
} from '~helpers/strongIdentities'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import {
  getStrongLexiconModuleAvailability,
  withOptionalStrongLexiconDatabase,
  withStrongLexiconDatabase,
  type StrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'
import {
  decodeStrongLexiconPageCursor,
  encodeStrongLexiconPageCursor,
  StrongLexiconChapterEntitiesResponseDto,
  StrongLexiconEntryDto,
  StrongLexiconEntryCardsDto,
  StrongLexiconEntityResponseDto,
  StrongLexiconModuleStateDto,
  StrongLexiconMorphologyResponseDto,
  StrongLexiconSearchResponseDto,
} from './strongLexiconContract'
import { resolveHybridResourceSource } from './hybridResourcePolicy'
import { ResourceAccessError, resourceAccessErrorFromHttpResponse } from './resourceAccessError'

const STRONG_LEXICON_MODULE_SCHEMA_VERSION = 2

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
  targetStepCodes?: string[]
  targetCategory?: string
  targetType?: string
  targetName: string
}

export type StrongLexiconEntityCategory = 'person' | 'place' | 'group' | 'supernatural' | 'other'

export type StrongLexiconEntity = {
  id: number
  uniqueName: string
  strongCodes: string[]
  name: string
  category: string
  type: string
  description: string
  shortDescription: string
  summaryHtml: string
  brief: string
  articleHtml: string
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

export type StrongLexiconChapterEntity = {
  uniqueName: string
  name: string
  category: StrongLexiconEntityCategory
  type: string
  verses: number[]
}

export type StrongLexiconEntry = {
  id: number
  selectedIdentity: StrongIdentity
  stepCode: string
  classicStrong: string
  eStrong: string
  dStrong: string
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

export type StrongLexiconEntryCard = Pick<
  StrongLexiconEntry,
  | 'id'
  | 'selectedIdentity'
  | 'stepCode'
  | 'classicStrong'
  | 'eStrong'
  | 'dStrong'
  | 'language'
  | 'baseCode'
  | 'original'
  | 'transliteration'
  | 'pronunciation'
  | 'gloss'
  | 'definitionHtml'
  | 'morphology'
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

export type StrongLexiconPage = {
  entries: StrongLexiconSearchResult[]
  nextCursor?: string
}

export type StrongLexiconListRequest = {
  signal?: AbortSignal
  language: ResourceLanguage
  lexicalLanguage?: 'greek' | 'hebrew'
  search?: string
  prefix?: string
  limit?: number
  cursor?: string
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

export const formatStrongEntityDisplayName = (value: string): string => value.replace(/_+/gu, ' ')

const normalizeStrongEntityCategory = (
  value: string,
  type: string
): StrongLexiconEntityCategory => {
  if (type.toLowerCase() === 'supernatural') return 'supernatural'
  return value === 'person' || value === 'place' || value === 'group' ? value : 'other'
}

const TIPNR_BOOK_CODES = [
  'Gen',
  'Exo',
  'Lev',
  'Num',
  'Deu',
  'Jos',
  'Jdg',
  'Rut',
  '1Sa',
  '2Sa',
  '1Ki',
  '2Ki',
  '1Ch',
  '2Ch',
  'Ezr',
  'Neh',
  'Est',
  'Job',
  'Psa',
  'Pro',
  'Ecc',
  'Sng',
  'Isa',
  'Jer',
  'Lam',
  'Ezk',
  'Dan',
  'Hos',
  'Jol',
  'Amo',
  'Oba',
  'Jon',
  'Mic',
  'Nam',
  'Hab',
  'Zep',
  'Hag',
  'Zec',
  'Mal',
  'Mat',
  'Mrk',
  'Luk',
  'Jhn',
  'Act',
  'Rom',
  '1Co',
  '2Co',
  'Gal',
  'Eph',
  'Php',
  'Col',
  '1Th',
  '2Th',
  '1Ti',
  '2Ti',
  'Tit',
  'Phm',
  'Heb',
  'Jas',
  '1Pe',
  '2Pe',
  '1Jn',
  '2Jn',
  '3Jn',
  'Jud',
  'Rev',
] as const

export const getTipnrBookCode = (book: number): string | undefined => TIPNR_BOOK_CODES[book - 1]

type ChapterEntityRow = {
  uniqueName: string
  displayName: string
  localizedDisplayName: string | null
  category: string
  type: string
  verses: string | null
}

const toChapterEntity = (
  row: ChapterEntityRow,
  language: ResourceLanguage
): StrongLexiconChapterEntity => ({
  uniqueName: row.uniqueName,
  name: formatStrongEntityDisplayName(
    chooseLocalized(language, row.localizedDisplayName, row.displayName)
  ),
  category: normalizeStrongEntityCategory(row.category, row.type),
  type: row.type,
  verses: [
    ...new Set(
      (row.verses ?? '')
        .split(',')
        .map(Number)
        .filter(verse => Number.isInteger(verse) && verse > 0)
    ),
  ].sort((left, right) => left - right),
})

const loadEntityStrongCodeMap = async (
  database: SQLiteDatabase,
  uStrongValues: string[]
): Promise<Map<string, string[]>> => {
  const uniqueValues = [...new Set(uStrongValues.filter(Boolean))]
  if (!uniqueValues.length) return new Map()
  const placeholders = uniqueValues.map(() => '?').join(', ')
  const rows = await database.getAllAsync<{ uStrong: string; code: string }>(
    `SELECT DISTINCT e.uStrong, i.stepCode AS code
       FROM StepEntries e
       JOIN StepEntryIdentities i ON i.stepEntryId=e.id
      WHERE e.uStrong IN (${placeholders})
      ORDER BY e.uStrong, i.stepCode`,
    uniqueValues
  )
  return new Map(
    uniqueValues.map(uStrong => [
      uStrong,
      getDisplayedStrongIdentities(
        rows
          .filter(row => row.uStrong === uStrong)
          .map(row => createStrongIdentity(row.code, inferLanguage(row.code)))
      ).map(identity => identity.code),
    ])
  )
}

const hydrateEntity = async (
  database: SQLiteDatabase,
  core: SQLiteDatabase,
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
      targetId: number | null
      targetUniqueName: string | null
      targetUStrong: string | null
      targetCategory: string | null
      targetType: string | null
      targetName: string | null
      localizedTargetName: string | null
      toUniqueName: string
    }>(
      `SELECT r.relation, r.certainty, r.toUniqueName,
              target.id AS targetId,
              target.uniqueName AS targetUniqueName,
              target.uStrong AS targetUStrong,
              target.category AS targetCategory,
              target.type AS targetType,
              target.displayName AS targetName,
              tr.displayName AS localizedTargetName
         FROM EntityRelations r
         LEFT JOIN Entities target ON target.id=COALESCE(
           r.toEntityId,
           (SELECT fallback.id
              FROM Entities fallback
             WHERE fallback.uniqueName=CASE
               WHEN instr(r.toUniqueName, '|') > 0
                 THEN substr(r.toUniqueName, instr(r.toUniqueName, '|') + 1)
               ELSE r.toUniqueName
             END
             LIMIT 1)
         )
         LEFT JOIN EntityTranslations tr ON tr.entityId=target.id AND tr.language=?
        WHERE r.fromEntityId=?
        ORDER BY r.relation, target.displayName`,
      [language, entity.id]
    ),
  ])

  const strongCodeMap = await loadEntityStrongCodeMap(core, [
    entity.uStrong,
    ...relations.flatMap(relation => (relation.targetUStrong ? [relation.targetUStrong] : [])),
  ])
  const strongCodes = strongCodeMap.get(entity.uStrong) ?? []

  return {
    id: entity.id,
    uniqueName: entity.uniqueName,
    strongCodes,
    name: formatStrongEntityDisplayName(
      chooseLocalized(language, entity.localizedDisplayName, entity.displayName)
    ),
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
    ...(place
      ? {
          place: {
            name: formatStrongEntityDisplayName(place.openBibleName),
            area: place.area,
            ...(place.latitude == null ? {} : { latitude: place.latitude }),
            ...(place.longitude == null ? {} : { longitude: place.longitude }),
            ...(place.googleMapUrl ? { googleMapUrl: place.googleMapUrl } : {}),
            ...(place.palopenmapsUrl ? { palopenmapsUrl: place.palopenmapsUrl } : {}),
          },
        }
      : {}),
    relations: relations.map((relation, index) => ({
      relation: relation.relation,
      certainty: relation.certainty,
      ...(relation.targetId == null ? {} : { targetId: relation.targetId }),
      ...(relation.targetUniqueName ? { targetUniqueName: relation.targetUniqueName } : {}),
      ...(relation.targetUStrong && strongCodeMap.get(relation.targetUStrong)?.length
        ? { targetStepCodes: strongCodeMap.get(relation.targetUStrong)! }
        : {}),
      ...(relation.targetCategory ? { targetCategory: relation.targetCategory } : {}),
      ...(relation.targetType ? { targetType: relation.targetType } : {}),
      targetName: formatStrongEntityDisplayName(
        chooseLocalized(language, relation.localizedTargetName, relation.targetName ?? '') ||
          relation.toUniqueName
      ),
    })),
  }
}

const loadEntityForEntry = async (
  core: SQLiteDatabase,
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

  return hydrateEntity(database, core, entity, language)
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
          loadEntityForEntry(core, database, row, language)
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
  getModuleRecoveryActions?: (moduleId: StrongLexiconModuleId) => Promise<'acquire-offline-copy'[]>
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
  loadEntryCards: (
    identities: StrongIdentity[],
    language: ResourceLanguage
  ) => Promise<StrongLexiconEntryCard[]>
  loadMorphologies: (
    codes: string[],
    language: ResourceLanguage
  ) => Promise<StrongLexiconMorphology[]>
  loadEntity: (
    uniqueName: string,
    language: ResourceLanguage
  ) => Promise<StrongLexiconEntity | undefined>
  loadChapterEntities: (
    book: number,
    chapter: number,
    language: ResourceLanguage,
    strongCodes?: string[]
  ) => Promise<StrongLexiconChapterEntity[]>
  listEntries: (request: StrongLexiconListRequest) => Promise<StrongLexiconPage>
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
  getModuleRecoveryActions: async () => ['acquire-offline-copy'],

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
    return withStrongLexiconDatabase('core', core =>
      withOptionalStrongLexiconDatabase('entities', async database => {
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
        return row ? hydrateEntity(database, core, row, language) : undefined
      }).then(entity => entity ?? undefined)
    )
  },

  async loadChapterEntities(book, chapter, language, strongCodes = []) {
    const bookCode = getTipnrBookCode(book)
    if (!bookCode) return []
    const availability = await getStrongLexiconModuleAvailability('entities')
    if (availability.status !== 'available') return []
    const normalizedStrongCodes = [
      ...new Set(strongCodes.map(code => code.trim().toUpperCase()).filter(Boolean)),
    ]
    const strongPlaceholders = normalizedStrongCodes.map(() => '?').join(', ')
    const strongFilter = normalizedStrongCodes.length
      ? ` OR (
            e.uStrong IN (${strongPlaceholders})
            AND (SELECT COUNT(*) FROM Entities matching WHERE matching.uStrong=e.uStrong)=1
          )`
      : ''

    return withOptionalStrongLexiconDatabase('entities', async database => {
      const rows = await database.getAllAsync<ChapterEntityRow>(
        `SELECT e.uniqueName, e.displayName, e.category, e.type,
                tr.displayName AS localizedDisplayName,
                GROUP_CONCAT(DISTINCT refs.verse) AS verses
           FROM Entities e
           LEFT JOIN EntityTranslations tr ON tr.entityId=e.id AND tr.language=?
           LEFT JOIN EntityRefs refs
             ON refs.entityId=e.id AND refs.book=? AND refs.chapter=?
          WHERE refs.entityId IS NOT NULL${strongFilter}
          GROUP BY e.id
          ORDER BY CASE e.category
            WHEN 'person' THEN 0
            WHEN 'place' THEN 1
            WHEN 'group' THEN 2
            ELSE 3
          END, COALESCE(NULLIF(tr.displayName, ''), e.displayName), e.id`,
        [language, bookCode, chapter, ...normalizedStrongCodes]
      )
      return rows.map(row => toChapterEntity(row, language))
    }).then(entities => entities ?? [])
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

  async loadEntryCards(identities, language) {
    return localStrongLexiconAccess.loadEntries(identities, language)
  },

  async loadMorphologies(codes, language) {
    return withStrongLexiconDatabase('core', core => loadMorphologies(core, codes, language))
  },

  async listEntries({
    language,
    lexicalLanguage,
    search,
    prefix,
    limit = 100,
    cursor: encodedCursor,
  }) {
    const normalizedSearch = search?.trim()
    const normalizedPrefix = prefix?.trim()
    if (!normalizedSearch && !normalizedPrefix) return { entries: [] }
    const cursor = decodeStrongLexiconPageCursor(encodedCursor)
    const pattern = normalizedSearch ? `%${normalizedSearch}%` : `${normalizedPrefix}%`
    return withStrongLexiconDatabase('core', async core => {
      const candidateFilters: string[] = []
      const filters = ['unifiedRank=1']
      const parameters: (string | number)[] = [language]
      if (lexicalLanguage) {
        candidateFilters.push('e.language=?')
        parameters.push(lexicalLanguage)
      }
      candidateFilters.push(
        normalizedSearch
          ? `(i.stepCode LIKE ? OR e.eStrong LIKE ? OR e.dStrong LIKE ? OR e.original LIKE ? OR e.transliteration LIKE ? OR e.gloss LIKE ? OR tr.gloss LIKE ?)`
          : `lower(COALESCE(NULLIF(tr.gloss, ''), e.gloss)) LIKE ?`
      )
      parameters.push(...Array(normalizedSearch ? 7 : 1).fill(pattern))
      if (cursor) {
        filters.push(
          `(sortGloss > ? OR (sortGloss = ? AND baseCode > ?) OR (sortGloss = ? AND baseCode = ? AND id > ?))`
        )
        parameters.push(
          cursor.gloss,
          cursor.gloss,
          cursor.baseCode,
          cursor.gloss,
          cursor.baseCode,
          cursor.id
        )
      }
      parameters.push(limit + 1)
      const rows = await core.getAllAsync<CoreEntryRow & { sortGloss: string }>(
        `WITH rankedEntries AS (
           SELECT e.*, i.stepCode,
                  tr.gloss AS localizedGloss,
                  tr.meaning AS localizedMeaning,
                  tr.meaningHtml AS localizedMeaningHtml,
                  lower(COALESCE(NULLIF(tr.gloss, ''), e.gloss)) AS sortGloss,
                  ROW_NUMBER() OVER (
                    PARTITION BY e.language, COALESCE(NULLIF(e.uStrong, ''), CAST(e.id AS TEXT))
                    ORDER BY CASE WHEN i.stepCode=e.uStrong THEN 0 ELSE 1 END, e.id
                  ) AS unifiedRank
             FROM StepEntries e
             JOIN StepEntryIdentities i ON i.stepEntryId=e.id
             LEFT JOIN LexiconTranslations tr ON tr.stepEntryId=e.id AND tr.language=?
            WHERE ${candidateFilters.join(' AND ')}
         )
         SELECT * FROM rankedEntries
          WHERE ${filters.join(' AND ')}
          ORDER BY sortGloss, baseCode, id
          LIMIT ?`,
        parameters
      )
      const hasNextPage = rows.length > limit
      const selected = rows.slice(0, limit)
      const last = selected.at(-1)
      return {
        entries: selected.map(row => toSearchResult(row, language)),
        ...(hasNextPage && last
          ? {
              nextCursor: encodeStrongLexiconPageCursor({
                gloss: last.sortGloss,
                baseCode: last.baseCode,
                id: last.id,
              }),
            }
          : {}),
      }
    })
  },

  async search(query, language, limit = 100) {
    return (await this.listEntries({ language, search: query, limit })).entries
  },

  async browseByGlossPrefix(prefix, language, limit = 50) {
    return (await this.listEntries({ language, prefix, limit })).entries
  },

  async random(lexicalLanguage, language) {
    return withStrongLexiconDatabase('core', async core => {
      const bounds = await core.getFirstAsync<{ minimum: number | null; maximum: number | null }>(
        `SELECT MIN(id) AS minimum, MAX(id) AS maximum
           FROM StepEntries
          WHERE language=? AND gloss <> ''`,
        [lexicalLanguage]
      )
      if (bounds?.minimum == null || bounds.maximum == null) return undefined
      const threshold =
        bounds.minimum + Math.floor(Math.random() * (bounds.maximum - bounds.minimum + 1))
      const select = `SELECT e.*, i.stepCode,
              tr.gloss AS localizedGloss,
              tr.meaning AS localizedMeaning,
              tr.meaningHtml AS localizedMeaningHtml
         FROM StepEntries e
         JOIN StepEntryIdentities i ON i.stepEntryId=e.id
         LEFT JOIN LexiconTranslations tr
           ON tr.stepEntryId=e.id AND tr.language=?
        WHERE e.language=? AND e.gloss <> ''`
      const row =
        (await core.getFirstAsync<CoreEntryRow>(`${select} AND e.id >= ? ORDER BY e.id LIMIT 1`, [
          language,
          lexicalLanguage,
          threshold,
        ])) ??
        (await core.getFirstAsync<CoreEntryRow>(
          `${select} AND e.id < ? ORDER BY e.id DESC LIMIT 1`,
          [language, lexicalLanguage, threshold]
        ))
      return row ? toSearchResult(row, language) : undefined
    })
  },
}

type HttpStrongLexiconAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const mapHttpStrongLexiconFailure = (response: Response, code: unknown) => {
  if (
    response.status === 404 &&
    (code === 'STRONG_LEXICON_ENTRY_NOT_FOUND' || code === 'STRONG_LEXICON_ENTITY_NOT_FOUND')
  ) {
    return resourceAccessErrorFromHttpResponse('NOT_FOUND', response, code)
  }
  if (response.status === 503 && code === 'STRONG_LEXICON_PUBLICATION_INACTIVE') {
    return resourceAccessErrorFromHttpResponse('OFFLINE_COPY_REQUIRED', response, code, [
      'acquire-offline-copy',
    ])
  }
  return resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
}

export const createHttpStrongLexiconAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpStrongLexiconAccessOptions): StrongLexiconAccess => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const get = async <A>(
    path: string,
    schema: Schema.Schema<A>,
    signal?: AbortSignal
  ): Promise<A> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        throw mapHttpStrongLexiconFailure(response, code)
      }
      try {
        return Schema.decodeUnknownSync(schema)(payload)
      } catch {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
    } catch (error) {
      if (signal?.aborted) throw error
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  const languageQuery = (language: ResourceLanguage, kind?: StrongIdentityKind) =>
    `language=${encodeURIComponent(language)}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`
  const loadSearch = async (query: URLSearchParams, signal?: AbortSignal) => {
    const response = await get(
      `/v1/strong-lexicon/entries?${query}`,
      StrongLexiconSearchResponseDto,
      signal
    )
    return {
      entries: [...response.entries],
      ...(response.nextCursor ? { nextCursor: response.nextCursor } : {}),
    }
  }
  const toEntry = (
    response: Schema.Schema.Type<typeof StrongLexiconEntryDto>
  ): StrongLexiconEntry => {
    const { resource: _resource, ...entry } = response
    const toAvailability = (
      moduleId: 'resources' | 'entities',
      state: typeof entry.modules.resources
    ): StrongLexiconModuleAvailability =>
      state.status === 'available'
        ? {
            status: 'available',
            moduleId,
            revision: state.revision,
            schemaVersion: STRONG_LEXICON_MODULE_SCHEMA_VERSION,
          }
        : state.status === 'incompatible'
          ? { status: 'incompatible', moduleId, installedRevision: state.revision }
          : { status: 'missing', moduleId }
    return {
      ...entry,
      modules: {
        resources: toAvailability('resources', entry.modules.resources),
        entities: toAvailability('entities', entry.modules.entities),
      },
    } as StrongLexiconEntry
  }
  return {
    async getModuleAvailability(moduleId) {
      const state = await get(`/v1/strong-lexicon/modules/${moduleId}`, StrongLexiconModuleStateDto)
      if (state.status === 'available') {
        return {
          status: 'available',
          moduleId,
          revision: state.revision,
          schemaVersion: STRONG_LEXICON_MODULE_SCHEMA_VERSION,
        }
      }
      if (state.status === 'incompatible') {
        return { status: 'incompatible', moduleId, installedRevision: state.revision }
      }
      return { status: 'missing', moduleId }
    },
    getModuleRecoveryActions: async () => [],
    async loadEntry(identity, language) {
      try {
        const response = await get(
          `/v1/strong-lexicon/entries/${encodeURIComponent(identity.code)}?${languageQuery(language, identity.kind)}`,
          StrongLexiconEntryDto
        )
        return toEntry(response)
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    async loadEntries(identities, language) {
      const entries = await Promise.all(
        identities.map(identity => this.loadEntry(identity, language))
      )
      return entries.filter((entry): entry is StrongLexiconEntry => Boolean(entry))
    },
    async loadEntryCards(identities, language) {
      if (identities.length === 0) return []
      const params = new URLSearchParams({
        language,
        identities: identities.map(identity => `${identity.kind}:${identity.code}`).join(','),
      })
      const response = await get(
        `/v1/strong-lexicon/entries/batch?${params}`,
        StrongLexiconEntryCardsDto
      )
      return response.entries.map(({ resource: _resource, ...entry }) => entry)
    },
    async loadPreview(identities, language) {
      const entries = await this.loadEntryCards(identities, language)
      return entries.map(entry => ({
        id: entry.id,
        selectedIdentity: entry.selectedIdentity,
        stepCode: entry.stepCode,
        classicStrong: entry.classicStrong,
        language: entry.language,
        original: entry.original,
        transliteration: entry.transliteration,
        gloss: entry.gloss,
        definitionHtml: entry.definitionHtml,
      }))
    },
    async loadMorphologies(codes, language) {
      if (!codes.length) return []
      const response = await get(
        `/v1/strong-lexicon/morphologies?${languageQuery(language)}&codes=${encodeURIComponent(codes.join(','))}`,
        StrongLexiconMorphologyResponseDto
      )
      return [...response.morphologies]
    },
    async loadEntity(uniqueName, language) {
      try {
        const response = await get(
          `/v1/strong-lexicon/entities/${encodeURIComponent(uniqueName)}?${languageQuery(language)}`,
          StrongLexiconEntityResponseDto
        )
        return response.entity as StrongLexiconEntity
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    async loadChapterEntities(book, chapter, language, strongCodes = []) {
      const bookCode = getTipnrBookCode(book)
      if (!bookCode) return []
      const query = new URLSearchParams({ language })
      if (strongCodes.length) query.set('strongCodes', strongCodes.join(','))
      const response = await get(
        `/v1/strong-lexicon/entities/chapters/${bookCode}/${chapter}?${query}`,
        StrongLexiconChapterEntitiesResponseDto
      )
      return response.entities.map(entity => ({ ...entity, verses: [...entity.verses] }))
    },
    listEntries({ signal, language, lexicalLanguage, search, prefix, limit = 100, cursor }) {
      const query = new URLSearchParams({ language, limit: String(limit) })
      if (lexicalLanguage) query.set('lexicalLanguage', lexicalLanguage)
      if (search) query.set('search', search)
      if (prefix) query.set('prefix', prefix)
      if (cursor) query.set('cursor', cursor)
      return loadSearch(query, signal)
    },
    search(query, language, limit = 100) {
      return this.listEntries({ language, search: query, limit }).then(page => page.entries)
    },
    browseByGlossPrefix(prefix, language, limit = 50) {
      return this.listEntries({ language, prefix, limit }).then(page => page.entries)
    },
    async random(lexicalLanguage, language) {
      const response = await get(
        `/v1/strong-lexicon/random?${new URLSearchParams({ language, lexicalLanguage })}`,
        StrongLexiconSearchResponseDto
      )
      return response.entries[0]
    },
  }
}

export const createHybridStrongLexiconAccess = ({
  offline,
  online,
  remotelyReadable,
  isOnline,
}: {
  offline: StrongLexiconAccess
  online: StrongLexiconAccess
  remotelyReadable: boolean
  isOnline: () => Promise<boolean>
}): StrongLexiconAccess => {
  const localAvailable = async (moduleId: StrongLexiconModuleId) =>
    (await offline.getModuleAvailability(moduleId)).status === 'available'
  const select = async <T>(
    moduleId: StrongLexiconModuleId,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    const source = await resolveHybridResourceSource({
      localAvailable: await localAvailable(moduleId),
      remotelyReadable,
      isOnline,
    })
    switch (source) {
      case 'local':
        return localOperation()
      case 'remote':
        return remoteOperation()
      case 'offline':
        throw new ResourceAccessError('NETWORK_OFFLINE')
      case 'unsupported':
        throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }
  }
  const searchFirstOnline = async <T>(
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    if (remotelyReadable && (await isOnline())) {
      try {
        return await remoteOperation()
      } catch (error) {
        if (
          (await localAvailable('core')) &&
          error instanceof ResourceAccessError &&
          (error.code === 'TEMPORARY_UNAVAILABLE' || error.code === 'NETWORK_OFFLINE')
        ) {
          return localOperation()
        }
        throw error
      }
    }
    if (await localAvailable('core')) return localOperation()
    throw new ResourceAccessError(remotelyReadable ? 'NETWORK_OFFLINE' : 'OFFLINE_COPY_REQUIRED')
  }
  return {
    async getModuleAvailability(moduleId) {
      const local = await offline.getModuleAvailability(moduleId)
      if (local.status === 'available' || !remotelyReadable) return local
      if (!(await isOnline())) return local
      try {
        return await online.getModuleAvailability(moduleId)
      } catch {
        return local
      }
    },
    async getModuleRecoveryActions(moduleId) {
      const local = await offline.getModuleAvailability(moduleId)
      return local.status === 'available' || remotelyReadable ? [] : ['acquire-offline-copy']
    },
    loadPreview: (identities, language) =>
      select(
        'core',
        () => offline.loadPreview(identities, language),
        () => online.loadPreview(identities, language)
      ),
    loadEntry: (identity, language) =>
      select(
        'core',
        () => offline.loadEntry(identity, language),
        () => online.loadEntry(identity, language)
      ),
    loadEntries: (identities, language) =>
      select(
        'core',
        () => offline.loadEntries(identities, language),
        () => online.loadEntries(identities, language)
      ),
    loadEntryCards: (identities, language) =>
      select(
        'core',
        () => offline.loadEntryCards(identities, language),
        () => online.loadEntryCards(identities, language)
      ),
    loadMorphologies: (codes, language) =>
      select(
        'core',
        () => offline.loadMorphologies(codes, language),
        () => online.loadMorphologies(codes, language)
      ),
    loadEntity: (uniqueName, language) =>
      select(
        'entities',
        () => offline.loadEntity(uniqueName, language),
        () => online.loadEntity(uniqueName, language)
      ),
    loadChapterEntities: (book, chapter, language, strongCodes) =>
      select(
        'entities',
        () => offline.loadChapterEntities(book, chapter, language, strongCodes),
        () => online.loadChapterEntities(book, chapter, language, strongCodes)
      ),
    listEntries: request =>
      searchFirstOnline(
        () => offline.listEntries(request),
        () => online.listEntries(request)
      ),
    search: (query, language, limit) =>
      searchFirstOnline(
        () => offline.search(query, language, limit),
        () => online.search(query, language, limit)
      ),
    browseByGlossPrefix: (prefix, language, limit) =>
      searchFirstOnline(
        () => offline.browseByGlossPrefix(prefix, language, limit),
        () => online.browseByGlossPrefix(prefix, language, limit)
      ),
    random: (lexicalLanguage, language) =>
      select(
        'core',
        () => offline.random(lexicalLanguage, language),
        () => online.random(lexicalLanguage, language)
      ),
  }
}
