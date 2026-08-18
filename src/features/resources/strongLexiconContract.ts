import { Schema } from 'effect'
import {
  decodeStrongLexiconPageCursor,
  encodeStrongLexiconPageCursor,
} from '~helpers/resourcePageCursor'

export { decodeStrongLexiconPageCursor, encodeStrongLexiconPageCursor }

export const StrongLexiconLanguage = Schema.Literal('fr', 'en')
export const StrongLexicalLanguage = Schema.Literal('greek', 'hebrew')
export const StrongLexiconModuleIdSchema = Schema.Literal('core', 'resources', 'entities')
export const StrongLexiconIdentityKind = Schema.Literal('strong', 'estrong', 'dstrong', 'ustrong')

export class StrongLexiconEntryPath extends Schema.Class<StrongLexiconEntryPath>(
  'StrongLexiconEntryPath'
)({ reference: Schema.NonEmptyString }) {}

export class StrongLexiconEntityPath extends Schema.Class<StrongLexiconEntityPath>(
  'StrongLexiconEntityPath'
)({ uniqueName: Schema.NonEmptyString }) {}

export class StrongLexiconChapterEntitiesPath extends Schema.Class<StrongLexiconChapterEntitiesPath>(
  'StrongLexiconChapterEntitiesPath'
)({
  bookCode: Schema.NonEmptyString,
  chapter: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
}) {}

export class StrongLexiconModulePath extends Schema.Class<StrongLexiconModulePath>(
  'StrongLexiconModulePath'
)({ moduleId: StrongLexiconModuleIdSchema }) {}

export class StrongLexiconLanguageQuery extends Schema.Class<StrongLexiconLanguageQuery>(
  'StrongLexiconLanguageQuery'
)({ language: StrongLexiconLanguage }) {}

export class StrongLexiconEntryQuery extends Schema.Class<StrongLexiconEntryQuery>(
  'StrongLexiconEntryQuery'
)({
  language: StrongLexiconLanguage,
  kind: Schema.optional(StrongLexiconIdentityKind),
}) {}

export class StrongLexiconBrowseQuery extends Schema.Class<StrongLexiconBrowseQuery>(
  'StrongLexiconBrowseQuery'
)({
  language: StrongLexiconLanguage,
  lexicalLanguage: Schema.optional(StrongLexicalLanguage),
  search: Schema.optional(Schema.String),
  prefix: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  cursor: Schema.optional(
    Schema.NonEmptyString.pipe(
      Schema.filter(value => decodeStrongLexiconPageCursor(value) !== undefined)
    )
  ),
}) {}

export class StrongLexiconRandomQuery extends Schema.Class<StrongLexiconRandomQuery>(
  'StrongLexiconRandomQuery'
)({ language: StrongLexiconLanguage, lexicalLanguage: StrongLexicalLanguage }) {}

export class StrongLexiconMorphologyQuery extends Schema.Class<StrongLexiconMorphologyQuery>(
  'StrongLexiconMorphologyQuery'
)({ language: StrongLexiconLanguage, codes: Schema.NonEmptyString }) {}

export class StrongLexiconChapterEntitiesQuery extends Schema.Class<StrongLexiconChapterEntitiesQuery>(
  'StrongLexiconChapterEntitiesQuery'
)({
  language: StrongLexiconLanguage,
  strongCodes: Schema.optional(Schema.String),
}) {}

export class StrongLexiconResourceDto extends Schema.Class<StrongLexiconResourceDto>(
  'StrongLexiconResourceDto'
)({
  id: Schema.Int,
  source: Schema.String,
  kind: Schema.String,
  title: Schema.String,
  contentHtml: Schema.String,
}) {}

export class StrongLexiconRelationDto extends Schema.Class<StrongLexiconRelationDto>(
  'StrongLexiconRelationDto'
)({
  group: Schema.Literal('subentry', 'identity', 'family'),
  relationKind: Schema.String,
  label: Schema.String,
  stepCode: Schema.String,
  gloss: Schema.String,
  original: Schema.String,
  transliteration: Schema.String,
}) {}

export class StrongLexiconMorphologyDto extends Schema.Class<StrongLexiconMorphologyDto>(
  'StrongLexiconMorphologyDto'
)({ code: Schema.String, meaning: Schema.String, description: Schema.optional(Schema.String) }) {}

export class StrongLexiconEntityRelationDto extends Schema.Class<StrongLexiconEntityRelationDto>(
  'StrongLexiconEntityRelationDto'
)({
  relation: Schema.String,
  certainty: Schema.String,
  targetId: Schema.optional(Schema.Int),
  targetUniqueName: Schema.optional(Schema.String),
  targetStepCodes: Schema.optional(Schema.Array(Schema.String)),
  targetCategory: Schema.optional(Schema.String),
  targetType: Schema.optional(Schema.String),
  targetName: Schema.String,
}) {}

export class StrongLexiconEntityDto extends Schema.Class<StrongLexiconEntityDto>(
  'StrongLexiconEntityDto'
)({
  id: Schema.Int,
  uniqueName: Schema.String,
  strongCodes: Schema.Array(Schema.String),
  name: Schema.String,
  category: Schema.String,
  type: Schema.String,
  description: Schema.String,
  shortDescription: Schema.String,
  summaryHtml: Schema.String,
  brief: Schema.String,
  articleHtml: Schema.String,
  place: Schema.optional(
    Schema.Struct({
      name: Schema.String,
      area: Schema.String,
      latitude: Schema.optional(Schema.Number),
      longitude: Schema.optional(Schema.Number),
      googleMapUrl: Schema.optional(Schema.String),
      palopenmapsUrl: Schema.optional(Schema.String),
    })
  ),
  relations: Schema.Array(StrongLexiconEntityRelationDto),
}) {}

export class StrongLexiconModuleStateDto extends Schema.Class<StrongLexiconModuleStateDto>(
  'StrongLexiconModuleStateDto'
)({
  moduleId: StrongLexiconModuleIdSchema,
  status: Schema.Literal('available', 'unavailable', 'incompatible'),
  revision: Schema.optional(Schema.String),
  dependencyRevision: Schema.optional(Schema.String),
}) {}

export class StrongLexiconEntryDto extends Schema.Class<StrongLexiconEntryDto>(
  'StrongLexiconEntryDto'
)({
  resource: Schema.Struct({ revision: Schema.String }),
  id: Schema.Int,
  selectedIdentity: Schema.Struct({
    kind: StrongLexiconIdentityKind,
    code: Schema.String,
  }),
  stepCode: Schema.String,
  classicStrong: Schema.String,
  eStrong: Schema.String,
  dStrong: Schema.String,
  language: StrongLexicalLanguage,
  baseCode: Schema.Int,
  original: Schema.String,
  transliteration: Schema.String,
  pronunciation: Schema.optional(Schema.String),
  gloss: Schema.String,
  definitionHtml: Schema.optional(Schema.String),
  morphology: Schema.optional(StrongLexiconMorphologyDto),
  relations: Schema.Array(StrongLexiconRelationDto),
  resources: Schema.Array(StrongLexiconResourceDto),
  lsjAbsent: Schema.Boolean,
  entity: Schema.optional(StrongLexiconEntityDto),
  modules: Schema.Struct({
    resources: StrongLexiconModuleStateDto,
    entities: StrongLexiconModuleStateDto,
  }),
}) {}

export class StrongLexiconSearchResultDto extends Schema.Class<StrongLexiconSearchResultDto>(
  'StrongLexiconSearchResultDto'
)({
  id: Schema.Int,
  stepCode: Schema.String,
  classicStrong: Schema.String,
  language: StrongLexicalLanguage,
  original: Schema.String,
  transliteration: Schema.String,
  gloss: Schema.String,
}) {}

export class StrongLexiconSearchResponseDto extends Schema.Class<StrongLexiconSearchResponseDto>(
  'StrongLexiconSearchResponseDto'
)({
  resource: Schema.Struct({ revision: Schema.String }),
  entries: Schema.Array(StrongLexiconSearchResultDto),
  nextCursor: Schema.optional(Schema.String),
}) {}

export class StrongLexiconMorphologyResponseDto extends Schema.Class<StrongLexiconMorphologyResponseDto>(
  'StrongLexiconMorphologyResponseDto'
)({
  resource: Schema.Struct({ revision: Schema.String }),
  morphologies: Schema.Array(StrongLexiconMorphologyDto),
}) {}

export class StrongLexiconEntityResponseDto extends Schema.Class<StrongLexiconEntityResponseDto>(
  'StrongLexiconEntityResponseDto'
)({ resource: Schema.Struct({ revision: Schema.String }), entity: StrongLexiconEntityDto }) {}

export class StrongLexiconChapterEntityDto extends Schema.Class<StrongLexiconChapterEntityDto>(
  'StrongLexiconChapterEntityDto'
)({
  uniqueName: Schema.String,
  name: Schema.String,
  category: Schema.Literal('person', 'place', 'group', 'supernatural', 'other'),
  type: Schema.String,
  verses: Schema.Array(Schema.Int),
}) {}

export class StrongLexiconChapterEntitiesResponseDto extends Schema.Class<StrongLexiconChapterEntitiesResponseDto>(
  'StrongLexiconChapterEntitiesResponseDto'
)({
  resource: Schema.Struct({ revision: Schema.String }),
  entities: Schema.Array(StrongLexiconChapterEntityDto),
}) {}
