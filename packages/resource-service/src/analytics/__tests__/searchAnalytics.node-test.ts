import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SearchAnalyticsEventDto,
  SearchAnalyticsResultCountsDto,
} from '@bible-strong/mobile/src/features/resources/searchAnalyticsContract'
import {
  redactSearchQuery,
  sanitizeSearchAnalyticsEvent,
  searchQueryGroupKey,
} from '../searchAnalytics'

const event = (query: string) =>
  new SearchAnalyticsEventDto({
    event: 'search_performed',
    query,
    language: 'fr',
    origin: 'typed',
    inputKind: 'natural_language',
    sources: ['passages', 'strong'],
    versionIds: ['LSG'],
    outcome: 'success',
    resultCounts: new SearchAnalyticsResultCountsDto({
      total: 22,
      references: 0,
      passages: 20,
      strong: 2,
      dictionary: 0,
      nave: 0,
    }),
    matchKind: 'semantic',
    topicId: 'topic:anxiety',
  })

describe('search analytics privacy boundary', () => {
  it('keeps useful biblical wording while redacting direct identifiers and secrets', () => {
    assert.equal(
      redactSearchQuery(
        '  Anxiété pour jean@example.com https://example.com 0612345678 eyJabc.def.ghi  '
      ),
      'Anxiété pour [email] [url] [telephone] [secret]'
    )
  })

  it('creates an accent-insensitive grouping key without changing the stored query', () => {
    const sanitized = sanitizeSearchAnalyticsEvent(event('  Grâce   et  anxiété  '))
    assert.equal(sanitized?.query, 'Grâce et anxiété')
    assert.equal(sanitized?.queryKey, 'grace et anxiete')
    assert.equal(searchQueryGroupKey('ἀγάπη'), 'αγαπη')
  })

  it('deduplicates dimensions and drops unsafe identifiers', () => {
    const sanitized = sanitizeSearchAnalyticsEvent(
      new SearchAnalyticsEventDto({
        ...event('G26'),
        sources: ['strong', 'strong'],
        versionIds: ['LSG', 'LSG', 'bad/version'],
        topicId: 'not a topic',
        clickedResultKey: 'private value with spaces',
      })
    )

    assert.deepEqual(sanitized?.sources, ['strong'])
    assert.deepEqual(sanitized?.versionIds, ['LSG'])
    assert.equal(sanitized?.topicId, undefined)
    assert.equal(sanitized?.clickedResultKey, undefined)
  })
})
