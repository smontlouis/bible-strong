import { HttpApiBuilder, HttpApiSwagger } from '@effect/platform'
import * as NodeHttpServer from '@effect/platform-node/NodeHttpServer'
import * as NodeRuntime from '@effect/platform-node/NodeRuntime'
import { Effect, Layer } from 'effect'
import { createServer } from 'node:http'

import { makeLocalDatabase } from '../database/localDatabase'
import { BibleChapterRepository } from '../domain/bibleChapter'
import { NaveRepository } from '../domain/nave'
import { DictionaryRepository } from '../domain/dictionary'
import { StrongBibleRepository } from '../domain/strongBible'
import { InterlinearBibleRepository } from '../domain/interlinearBible'
import { StrongLexiconRepository } from '../domain/strongLexicon'
import { ResourceApiLive } from '../http/app'
import { makeKyselyBibleChapterRepository } from '../repositories/bibleChapterRepository'
import { makeKyselyNaveRepository } from '../repositories/naveRepository'
import { makeKyselyDictionaryRepository } from '../repositories/dictionaryRepository'
import { makeKyselyStrongBibleRepository } from '../repositories/strongBibleRepository'
import { makeKyselyInterlinearBibleRepository } from '../repositories/interlinearBibleRepository'
import { makeKyselyStrongLexiconRepository } from '../repositories/strongLexiconRepository'

const port = Number(process.env.RESOURCE_API_PORT ?? 8787)
const database = makeLocalDatabase({
  connectionString:
    process.env.RESOURCE_DATABASE_URL ??
    'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
})

const RepositoryLive = Layer.mergeAll(
  Layer.scoped(
    BibleChapterRepository,
    Effect.acquireRelease(Effect.succeed(makeKyselyBibleChapterRepository(database)), () =>
      Effect.promise(() => database.destroy())
    )
  ),
  Layer.succeed(NaveRepository, makeKyselyNaveRepository(database)),
  Layer.succeed(DictionaryRepository, makeKyselyDictionaryRepository(database)),
  Layer.succeed(StrongBibleRepository, makeKyselyStrongBibleRepository(database)),
  Layer.succeed(InterlinearBibleRepository, makeKyselyInterlinearBibleRepository(database)),
  Layer.succeed(StrongLexiconRepository, makeKyselyStrongLexiconRepository(database))
)
const ApiLive = ResourceApiLive.pipe(Layer.provide(RepositoryLive))

const DocumentationLive = HttpApiSwagger.layer({ path: '/docs' }).pipe(Layer.provide(ApiLive))

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(Layer.merge(ApiLive, DocumentationLive)),
  Layer.provide(NodeHttpServer.layer(createServer, { host: '0.0.0.0', port }))
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
