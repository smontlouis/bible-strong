import {
  readStudyLinks,
  StudyLinkDto,
  StudyLinksResponseDto,
  type StudyLinkKind,
  type StudyLinkLanguage,
  type StudyLinkRow,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { Context, Data, Effect } from 'effect'

export class ActiveStudyLinksPublicationUnavailable extends Data.TaggedError(
  'ActiveStudyLinksPublicationUnavailable'
) {}

export class StudyLinksRepositoryFailure extends Data.TaggedError('StudyLinksRepositoryFailure')<{
  readonly cause: unknown
}> {}

export type StudyLinksRepositoryError =
  | ActiveStudyLinksPublicationUnavailable
  | StudyLinksRepositoryFailure

export type StudyLinksInput = {
  readonly kind: StudyLinkKind
  readonly key: string
  readonly language: StudyLinkLanguage
}

export type ActiveStudyLinks = {
  readonly revision: string
  readonly rows: readonly StudyLinkRow[]
}

export type StudyLinksRepositoryService = {
  findLinks: (
    input: Pick<StudyLinksInput, 'kind' | 'key'>
  ) => Effect.Effect<ActiveStudyLinks, StudyLinksRepositoryError>
}

export class StudyLinksRepository extends Context.Tag('StudyLinksRepository')<
  StudyLinksRepository,
  StudyLinksRepositoryService
>() {}

export const readStudyLinksOf = (input: StudyLinksInput) =>
  Effect.gen(function* () {
    const repository = yield* StudyLinksRepository
    const { revision, rows } = yield* repository.findLinks({ kind: input.kind, key: input.key })
    return new StudyLinksResponseDto({
      kind: input.kind,
      key: input.key,
      language: input.language,
      revision,
      links: readStudyLinks(input.kind, input.language, rows).map(
        link => new StudyLinkDto(link as ConstructorParameters<typeof StudyLinkDto>[0])
      ),
    })
  })
