import type {
  StudyLinkKind,
  StudyLinkRow,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { Effect } from 'effect'
import type { Kysely } from 'kysely'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveStudyLinksPublicationUnavailable,
  StudyLinksRepositoryFailure,
  type StudyLinksRepositoryService,
} from '../domain/studyLinks'

export const makeKyselyStudyLinksRepository = (
  database: Kysely<ResourceDatabase>
): StudyLinksRepositoryService => ({
  findLinks: ({ kind, key }) =>
    Effect.gen(function* () {
      const publication = yield* Effect.tryPromise({
        try: () =>
          database
            .selectFrom('resource_publications')
            .select(['id', 'revision'])
            .where('resource_kind', '=', 'study-links')
            .where('status', '=', 'active')
            .executeTakeFirst(),
        catch: cause => new StudyLinksRepositoryFailure({ cause }),
      })
      if (!publication) return yield* new ActiveStudyLinksPublicationUnavailable()

      const rows = yield* Effect.tryPromise({
        try: async () => {
          const [fromLeft, fromRight] = await Promise.all([
            database
              .selectFrom('study_links as link')
              .innerJoin('study_link_nodes as node', join =>
                join
                  .onRef('node.publication_id', '=', 'link.publication_id')
                  .onRef('node.kind', '=', 'link.right_kind')
                  .onRef('node.key', '=', 'link.right_key')
              )
              .select([
                'node.kind',
                'node.key',
                'node.label_fr',
                'node.label_en',
                'node.detail_fr',
                'node.detail_en',
                'node.language',
                'node.position',
                'link.role',
              ])
              .where('link.publication_id', '=', publication.id)
              .where('link.left_kind', '=', kind)
              .where('link.left_key', '=', key)
              .execute(),
            database
              .selectFrom('study_links as link')
              .innerJoin('study_link_nodes as node', join =>
                join
                  .onRef('node.publication_id', '=', 'link.publication_id')
                  .onRef('node.kind', '=', 'link.left_kind')
                  .onRef('node.key', '=', 'link.left_key')
              )
              .select([
                'node.kind',
                'node.key',
                'node.label_fr',
                'node.label_en',
                'node.detail_fr',
                'node.detail_en',
                'node.language',
                'node.position',
                'link.role',
              ])
              .where('link.publication_id', '=', publication.id)
              .where('link.right_kind', '=', kind)
              .where('link.right_key', '=', key)
              .execute(),
          ])
          return [...fromLeft, ...fromRight].map(row => ({
            ...row,
            kind: row.kind as StudyLinkKind,
          })) satisfies StudyLinkRow[]
        },
        catch: cause => new StudyLinksRepositoryFailure({ cause }),
      })
      return { revision: publication.revision, rows }
    }),
})
