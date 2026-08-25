import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { Effect } from 'effect'

import { makeLocalDatabase } from '../database/localDatabase'
import { makeKyselyBibleSearchRepository } from '../repositories/bibleSearchRepository'
import type { ActiveBibleSearch } from '../domain/bibleSearch'
import { makeHttpTopicEmbeddingProvider } from './topicEmbedding'

const CASES = [
  { query: 'anxiété', expectedTopics: ['topic:anxiety'] },
  { query: 'passages sur l’anxiété', expectedTopics: ['topic:anxiety'] },
  { query: 'je suis inquiet pour demain', expectedTopics: ['topic:worry'] },
  {
    query: 'je me sens stressé sans raison',
    expectedTopics: [
      'topic:overcoming_stress',
      'topic:stress',
      'topic:being_stressed',
      'topic:worry_and_stress',
      'topic:fear_and_anxiety',
      'topic:worry',
    ],
  },
  { query: 'je n’arrive pas à dormir à cause de mes soucis', expectedTopics: ['topic:worry'] },
  { query: 'solitude', expectedTopics: ['topic:solitude', 'topic:loneliness'] },
  { query: 'deuil', expectedTopics: ['topic:grief'] },
  { query: 'pardonner à quelqu’un', expectedTopics: ['topic:forgiveness'] },
  { query: 'peur de mourir', expectedTopics: ['topic:fear'] },
  { query: 'confiance en Dieu', expectedTopics: ['topic:trust'] },
  { query: 'colère', expectedTopics: ['topic:anger'] },
  { query: 'amour', expectedTopics: ['topic:love'] },
  { query: 'condamner', expectedTopics: ['topic:condemnation'] },
  {
    query: 'j’ai l’impression que tout le monde m’a abandonné',
    expectedTopics: [
      'topic:abandonment',
      'topic:loneliness',
      'topic:alone',
      'topic:abandoning_friends',
      'topic:family_rejection',
      'topic:being_left_out',
    ],
  },
  {
    query: 'la mort d’un proche me laisse inconsolable',
    expectedTopics: [
      'topic:death_of_a_loved_one',
      'topic:loss_of_a_loved_one',
      'topic:losing_a_loved_one',
      'topic:losing_the_one_you_love',
      'topic:bereavement',
      'topic:grief',
      'topic:mourning',
    ],
  },
  {
    query: 'je refuse de pardonner à la personne qui m’a trahi',
    expectedTopics: [
      'topic:forgive',
      'topic:forgiveness',
      'topic:forgiving_people',
      'topic:forgiving_others',
    ],
  },
  {
    query: 'je suis amer quand quelqu’un possède plus que moi',
    expectedTopics: [
      'topic:envy',
      'topic:jealousy',
      'topic:envy_and_jealousy',
      'topic:jealousy_and_envy',
      'topic:being_jealous',
      'topic:being_envious',
    ],
  },
  {
    query: 'le poids de mes fautes passées m’écrase',
    expectedTopics: [
      'topic:guilt',
      'topic:releasing_your_burdens_and_guilt',
      'topic:forgiveness_of_past_sins',
      'topic:the_consequences_of_sin',
      'topic:feeling_guilty',
    ],
  },
  {
    query: 'j’ai l’impression que Dieu ne répond jamais quand je lui parle',
    expectedTopics: [
      'topic:prayer',
      'topic:doubt',
      'topic:god_answering_prayers',
      'topic:answered_prayer',
      'topic:unanswered_prayer',
    ],
  },
  {
    query: 'je retombe toujours dans la même mauvaise habitude',
    expectedTopics: [
      'topic:temptation',
      'topic:bad_habits',
      'topic:repeating_sin',
      'topic:repeated_sin',
      'topic:falling_into_temptation',
      'topic:overcoming_temptation',
    ],
  },
  {
    query: 'j’ai envie d’abandonner devant cette épreuve',
    expectedTopics: [
      'topic:courage',
      'topic:trials',
      'topic:do_not_give_up',
      'topic:overcoming_rejection',
      'topic:overcoming_temptation',
    ],
  },
  {
    query: 'mon esprit est agité en permanence',
    expectedTopics: [
      'topic:peace',
      'topic:peace_of_mind',
      'topic:anxiety',
      'topic:being_anxious',
      'topic:nervousness',
      'topic:being_nervous',
      'topic:fear_and_anxiety',
      'topic:panic_attacks',
      'topic:worry',
      'topic:troubled_mind',
    ],
  },
] as const

const percentile = (values: readonly number[], value: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0
}

const main = async () => {
  const database = makeLocalDatabase({
    connectionString:
      process.env.RESOURCE_DATABASE_URL ??
      'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
  })
  const repository = makeKyselyBibleSearchRepository(database, {
    embeddingProvider: makeHttpTopicEmbeddingProvider(
      process.env.RESOURCE_TOPIC_EMBEDDING_URL ?? 'http://127.0.0.1:8791'
    ),
  })
  const durations: number[] = []
  const candidates = {
    lexical: 0,
    topics: 0,
    vectorTopics: 0,
    thematicPassages: 0,
    fused: 0,
  }
  const sources: Record<string, number> = {}
  const queries: Record<string, unknown>[] = []
  let topTopicHits = 0

  try {
    for (const benchmarkCase of CASES) {
      const { query, expectedTopics } = benchmarkCase
      await Effect.runPromise(
        repository.search({ versionId: 'LSG', query, language: 'fr', limit: 5 })
      )
      let representative: ActiveBibleSearch | undefined
      const queryDurations: number[] = []
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const started = performance.now()
        representative = await Effect.runPromise(
          repository.search({ versionId: 'LSG', query, language: 'fr', limit: 5 })
        )
        const duration = performance.now() - started
        durations.push(duration)
        queryDurations.push(duration)
      }
      if (!representative) continue
      const diagnostics = representative.diagnostics
      if (diagnostics) {
        candidates.lexical += diagnostics.lexicalCandidates
        candidates.topics += diagnostics.topicCandidates
        candidates.vectorTopics += diagnostics.vectorTopicCandidates
        candidates.thematicPassages += diagnostics.thematicCandidates
        candidates.fused += diagnostics.fusedCandidates
        diagnostics.sourceCandidates.forEach(source => {
          sources[source.source] = (sources[source.source] ?? 0) + source.count
        })
      }
      const topTopicId = representative.results[0]?.match?.topicId
      const topTopicHit = Boolean(
        topTopicId && expectedTopics.some(expectedTopic => expectedTopic === topTopicId)
      )
      if (topTopicHit) topTopicHits += 1
      queries.push({
        query,
        expectedTopics,
        topTopicHit,
        medianMs: Math.round(percentile(queryDurations, 0.5)),
        count: representative.count,
        diagnostics,
        topResults: representative.results.map(result => ({
          reference: `${result.book}-${result.chapter}-${result.verse}`,
          endReference:
            result.endChapter && result.endVerse
              ? `${result.book}-${result.endChapter}-${result.endVerse}`
              : undefined,
          match: result.match,
        })),
      })
    }
  } finally {
    await database.destroy()
  }

  const report = {
    generatedAt: new Date().toISOString(),
    version: 'LSG',
    queryCount: CASES.length,
    measuredRuns: durations.length,
    quality: {
      topTopicHits,
      topTopicAccuracy: topTopicHits / CASES.length,
    },
    latencyMs: {
      p50: Math.round(percentile(durations, 0.5)),
      p95: Math.round(percentile(durations, 0.95)),
      max: Math.round(Math.max(...durations)),
    },
    candidateTotals: candidates,
    sourceCandidateTotals: sources,
    queries,
  }
  const path = resolve(
    process.env.RESOURCE_TOPIC_BENCHMARK_PATH ??
      '.local/topic-search-benchmark.json'
  )
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
