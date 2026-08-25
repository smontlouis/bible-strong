import { Schema } from 'effect'

const ProblemFields = {
  type: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  detail: Schema.NonEmptyString,
  requestId: Schema.NonEmptyString,
}

export class InvalidResourceRequestProblem extends Schema.TaggedError<InvalidResourceRequestProblem>()(
  'InvalidResourceRequestProblem',
  {
    ...ProblemFields,
    status: Schema.Literal(400),
    code: Schema.Literal('INVALID_RESOURCE_REQUEST'),
  }
) {}

export class ResourceNotFoundProblem extends Schema.TaggedError<ResourceNotFoundProblem>()(
  'ResourceNotFoundProblem',
  {
    ...ProblemFields,
    status: Schema.Literal(404),
    code: Schema.Literal(
      'BIBLE_UNSUPPORTED',
      'BIBLE_CHAPTER_NOT_FOUND',
      'BIBLE_VERSES_NOT_FOUND',
      'NAVE_UNSUPPORTED',
      'NAVE_TOPIC_NOT_FOUND',
      'DICTIONARY_UNSUPPORTED',
      'DICTIONARY_ENTRY_NOT_FOUND',
      'STRONG_BIBLE_UNSUPPORTED',
      'STRONG_BIBLE_CHAPTER_NOT_FOUND',
      'INTERLINEAR_UNSUPPORTED',
      'INTERLINEAR_CHAPTER_NOT_FOUND',
      'STRONG_LEXICON_ENTRY_NOT_FOUND',
      'STRONG_LEXICON_ENTITY_NOT_FOUND',
      'SUPPLEMENTARY_CONTENT_NOT_FOUND',
      'TIMELINE_EVENT_NOT_FOUND'
    ),
  }
) {}

export class ResourceUnavailableProblem extends Schema.TaggedError<ResourceUnavailableProblem>()(
  'ResourceUnavailableProblem',
  {
    ...ProblemFields,
    status: Schema.Literal(503),
    code: Schema.Literal(
      'BIBLE_PUBLICATION_INACTIVE',
      'NAVE_PUBLICATION_INACTIVE',
      'DICTIONARY_PUBLICATION_INACTIVE',
      'STRONG_BIBLE_PUBLICATION_INACTIVE',
      'INTERLINEAR_PUBLICATION_INACTIVE',
      'STRONG_LEXICON_PUBLICATION_INACTIVE',
      'SUPPLEMENTARY_PUBLICATION_INACTIVE',
      'TIMELINE_PUBLICATION_INACTIVE'
    ),
    retryAfterSeconds: Schema.Int.pipe(Schema.positive()),
  }
) {}

export class ResourceRateLimitedProblem extends Schema.TaggedError<ResourceRateLimitedProblem>()(
  'ResourceRateLimitedProblem',
  {
    ...ProblemFields,
    status: Schema.Literal(429),
    code: Schema.Literal('RESOURCE_RATE_LIMITED'),
    retryAfterSeconds: Schema.Int.pipe(Schema.positive()),
  }
) {}

export class ResourceInternalProblem extends Schema.TaggedError<ResourceInternalProblem>()(
  'ResourceInternalProblem',
  {
    ...ProblemFields,
    status: Schema.Literal(500),
    code: Schema.Literal('RESOURCE_INTERNAL_FAILURE'),
  }
) {}
