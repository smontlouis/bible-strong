import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { Effect } from 'effect'
import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyStrongLexiconRepository } from '../../repositories/strongLexiconRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { validatePublicationBundle } from '../publicationBundle'

const root = process.env.RESOURCE_SIMPLE_STRONG_BUNDLES_ROOT
describe(
  'Standalone simple Strong publications',
  { skip: process.env.RESOURCE_INTEGRATION !== '1' || !root },
  () => {
    it('imports both locales without STEP core, preserves every definition and resolves exact variants', async () => {
      const isolated = await createIsolatedPostgres(
        process.env.RESOURCE_DATABASE_URL ??
          'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
        'simple_strong',
        1
      )
      try {
        const repository = makeKyselyStrongLexiconRepository(isolated.database)
        for (const language of ['fr', 'en'] as const) {
          const bundle = path.join(root!, `simple-${language}`)
          const validated = await validatePublicationBundle(bundle)
          assert.equal(validated.canonical.format, 'bible-strong-canonical-strong-lexicon-module')
          if (validated.canonical.format !== 'bible-strong-canonical-strong-lexicon-module')
            throw new Error('Wrong canonical format')
          const imported = await Effect.runPromise(
            importPublicationBundle(bundle, isolated.database, {
              activateForLocalDevelopment: true,
            })
          )
          assert.equal(imported.status, 'activated')
          assert.equal(
            (await Effect.runPromise(repository.getModuleState(`simple-${language}`))).status,
            'available'
          )
          assert.equal(
            (await Effect.runPromise(repository.getModuleState('core'))).status,
            'unavailable'
          )
          const publication = await isolated.database
            .selectFrom('resource_publications')
            .select('id')
            .where('resource_identity', '=', `strong-lexicon:simple-${language}`)
            .executeTakeFirstOrThrow()
          const stored = await isolated.database
            .selectFrom('strong_lexicon_entries')
            .select(['entry_id', 'payload'])
            .where('publication_id', '=', publication.id)
            .execute()
          const expected = new Map(
            validated.canonical.tables.StepEntries.map(row => [row.id, row.meaning])
          )
          assert.equal(stored.length, expected.size)
          for (const row of stored) assert.equal(row.payload.meaning, expected.get(row.entry_id))
          const love = await Effect.runPromise(
            repository.findEntry({ reference: 'G0026', language, level: 'simple' })
          )
          assert.match(
            love.value.definitionHtml ?? '',
            language === 'fr' ? /amour fraternel/ : /affection/
          )
          assert.deepEqual(love.value.resources, [])
          const exceptional = await Effect.runPromise(
            repository.findEntry({
              reference: 'G2491K',
              kind: 'dstrong',
              language,
              level: 'simple',
            })
          )
          assert.equal(exceptional.value.classicStrong, 'G2495')
          const legacyUrl = await Effect.runPromise(
            repository.findEntry({
              reference: 'H3651c',
              kind: 'dstrong',
              language,
              level: 'simple',
            })
          )
          assert.equal(legacyUrl.value.stepCode, 'H3651C')
          for (const code of ['H2148V', 'H2148v']) {
            const variant = await Effect.runPromise(
              repository.findEntry({ reference: code, kind: 'dstrong', language, level: 'simple' })
            )
            assert.equal(variant.value.stepCode, code)
          }
          const supplement = await Effect.runPromise(
            repository.findEntry({ reference: 'G9001', language, level: 'simple' })
          )
          assert.equal(supplement.value.definitionHtml, undefined)
          const search = await Effect.runPromise(
            repository.listEntries({
              language,
              level: 'simple',
              search: language === 'fr' ? 'amour' : 'love',
              limit: 10,
            })
          )
          assert.ok(search.value.entries.length)
          const random = await Effect.runPromise(
            repository.findRandom({ language, level: 'simple', lexicalLanguage: 'greek' })
          )
          assert.ok(random.value.length)
          const randomEntry = await Effect.runPromise(
            repository.findEntry({
              reference: random.value[0].stepCode,
              kind: 'dstrong',
              language,
              level: 'simple',
            })
          )
          assert.ok(randomEntry.value.definitionHtml)

          // A simple entry and its cards are read in one statement; the earlier read, one
          // statement per kind of row, returns the same response for every fiftieth entry.
          const statementByStatement = makeKyselyStrongLexiconRepository(isolated.database, {
            entryCardsRead: 'statement-by-statement',
          })
          const sampled = stored
            .filter(row => row.entry_id % 50 === 0)
            .map(row => ({
              dStrong: String(row.payload.dStrong).split(' ')[0]!,
              eStrong: String(row.payload.eStrong),
            }))
          assert.ok(sampled.length > 400)
          const senseSuffixes = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']
          for (const { dStrong, eStrong } of sampled) {
            for (const input of [
              { reference: dStrong, kind: 'dstrong' },
              { reference: dStrong.toLowerCase(), kind: 'dstrong' },
              { reference: eStrong },
            ] as const) {
              const read = (reader: typeof repository) =>
                Effect.runPromise(
                  Effect.either(reader.findEntry({ ...input, language, level: 'simple' }))
                )
              assert.equal(
                JSON.stringify(await read(repository)),
                JSON.stringify(await read(statementByStatement)),
                JSON.stringify(input)
              )
            }
            const senses = {
              identities: senseSuffixes.map(suffix => ({
                kind: 'dstrong' as const,
                reference: `${eStrong.replace(/[A-Za-z]+$/u, '')}${suffix}`,
              })),
              language,
              level: 'simple' as const,
            }
            assert.equal(
              JSON.stringify(await Effect.runPromise(repository.findEntryCards!(senses))),
              JSON.stringify(await Effect.runPromise(statementByStatement.findEntryCards!(senses))),
              eStrong
            )
          }
        }
      } finally {
        await isolated.dispose()
      }
    })
  }
)
