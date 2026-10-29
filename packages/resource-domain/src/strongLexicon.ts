import type { ResourceLanguage } from './interlinearBible'
import type { StrongIdentity } from './strongIdentities'

export type StrongLexiconModuleId = 'core' | 'resources' | 'entities' | 'simple-fr' | 'simple-en'

export type StrongLexiconModuleAvailability =
  | { status: 'missing'; moduleId: StrongLexiconModuleId }
  | { status: 'core-missing'; moduleId: Exclude<StrongLexiconModuleId, 'core'> }
  | { status: 'incompatible'; moduleId: StrongLexiconModuleId; installedRevision?: string }
  | { status: 'corrupt'; moduleId: StrongLexiconModuleId; reason: string }
  | {
      status: 'available'
      moduleId: StrongLexiconModuleId
      revision?: string
      schemaVersion?: number
    }

export type StrongLexiconMorphology = { code: string; meaning: string; description?: string }
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
/** An entity as a list of the whole publication names it. */
export type StrongLexiconListedEntity = {
  uniqueName: string
  name: string
  category: StrongLexiconEntityCategory
  type: string
  /** One line on who or what it is. */
  brief: string
  /** How many chapters name it. */
  chapterCount: number
  /** Where a place lies, when the publication knows it. */
  latitude?: number
  longitude?: number
}
/** The book codes of the entity publication (TIPNR), in the order of the Bible: book `n` is at `n - 1`. */
export const TIPNR_BOOK_CODES = [
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
/** The verses of one chapter that name an entity; `book` is a code of `TIPNR_BOOK_CODES`. */
export type StrongLexiconEntityPassage = {
  book: string
  chapter: number
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
  nameMeaningHtml?: string
  definitionHtml?: string
  detailedDefinitionHtml?: string
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
  | 'nameMeaningHtml'
  | 'definitionHtml'
  | 'morphology'
>
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
  | 'nameMeaningHtml'
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
/**
 * A sense of a classical number: its row in the simple lexicon of a language, then what its
 * entry in the detailed lexicon tells it apart by, when it has one.
 */
export type StrongLexiconNumberSense = StrongLexiconSearchResult & {
  detailedDefinitionHtml?: string
  entityBrief?: string
}
export type StrongLexiconPage = { entries: StrongLexiconSearchResult[]; nextCursor?: string }
export type StrongLexiconListRequest = {
  signal?: AbortSignal
  language: ResourceLanguage
  lexicalLanguage?: 'greek' | 'hebrew'
  search?: string
  prefix?: string
  limit?: number
  cursor?: string
}

export const getSimpleStrongModuleId = (language: ResourceLanguage): StrongLexiconModuleId =>
  language === 'fr' ? 'simple-fr' : 'simple-en'

export const isSimpleStrongModule = (moduleId: StrongLexiconModuleId): boolean =>
  moduleId === 'simple-fr' || moduleId === 'simple-en'

export const isStandaloneStrongModule = (moduleId: StrongLexiconModuleId): boolean =>
  moduleId === 'core' || isSimpleStrongModule(moduleId)

export const getStrongModuleSchema = (
  moduleId: StrongLexiconModuleId
): 'core' | 'resources' | 'entities' =>
  isSimpleStrongModule(moduleId) ? 'core' : (moduleId as 'core' | 'resources' | 'entities')
