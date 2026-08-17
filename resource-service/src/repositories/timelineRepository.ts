import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveTimelinePublicationUnavailable,
  TimelineEventNotFound,
  TimelineRepositoryFailure,
  type TimelineEvent,
  type TimelineEventSummary,
  type TimelineRepositoryService,
} from '../domain/timeline'

const mapEvent = (row: {
  event_id: string
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
  related: { slug: string; title: string }[]
  images: { caption: string; file: string }[]
  videos: { title: string; caption: string; filename: string }[]
  scriptures: string[]
}): TimelineEvent => ({
  id: row.event_id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  article: row.article,
  period: row.period,
  dates: row.dates,
  related: row.related,
  images: row.images,
  videos: row.videos,
  scriptures: row.scriptures,
})

const mapEventSummary = (row: {
  event_id: string
  slug: string
  title: string
  description: string
  period: string
  dates: string
  images: { caption: string; file: string }[]
}): TimelineEventSummary => ({
  id: row.event_id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  period: row.period,
  dates: row.dates,
  images: row.images,
})

export const makeKyselyTimelineRepository = (
  database: Kysely<ResourceDatabase>
): TimelineRepositoryService => {
  const findActivePublication = (language: 'fr' | 'en') =>
    tryDatabasePromise('timeline.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .select(['id', 'revision'])
        .where('resource_identity', '=', `timeline:${language}`)
        .where('status', '=', 'active')
        .executeTakeFirst()
    ).pipe(Effect.mapError(cause => new TimelineRepositoryFailure({ cause })))

  return {
    listEvents: (language, options = {}) =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(language)
        if (!publication) return yield* new ActiveTimelinePublicationUnavailable({ language })
        const rows = yield* tryDatabasePromise('timeline.events.list', () => {
          let query = database
            .selectFrom('timeline_events')
            .select(['event_id', 'slug', 'title', 'description', 'period', 'dates', 'images'])
            .where('publication_id', '=', publication.id)
          const search = options.search?.trim()
          if (search) {
            query = query.where(
              sql<boolean>`unaccent(lower(title || ' ' || description || ' ' || article)) LIKE unaccent(lower(${`%${search}%`}))`
            )
          }
          return query
            .orderBy('ordinal')
            .limit(Math.min(options.limit ?? (search ? 50 : 5_000), 5_000))
            .execute()
        }).pipe(Effect.mapError(cause => new TimelineRepositoryFailure({ cause })))
        return { language, revision: publication.revision, events: rows.map(mapEventSummary) }
      }),
    findEvent: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.language)
        if (!publication)
          return yield* new ActiveTimelinePublicationUnavailable({ language: input.language })
        const row = yield* tryDatabasePromise('timeline.event.read', () =>
          database
            .selectFrom('timeline_events')
            .selectAll()
            .where('publication_id', '=', publication.id)
            .where('slug', '=', input.slug)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new TimelineRepositoryFailure({ cause })))
        if (!row) return yield* new TimelineEventNotFound(input)
        return { language: input.language, revision: publication.revision, event: mapEvent(row) }
      }),
  }
}

export const makeNeonTimelineRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return { repository: makeKyselyTimelineRepository(database), dispose: () => database.destroy() }
}
