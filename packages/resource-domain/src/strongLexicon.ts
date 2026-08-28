import type { ResourceLanguage } from './interlinearBible'
import type { StrongIdentity } from './strongIdentities'

export type StrongLexiconModuleId = 'core' | 'resources' | 'entities'

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
