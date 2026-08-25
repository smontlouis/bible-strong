import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveBiblePublicationOverlay,
  type BiblePublicationSetEntry,
} from '../biblePublicationSet'

const bible = (revision: string, textSha256: string): BiblePublicationSetEntry => ({
  bundlePath: `/baseline/bible-${revision}`,
  catalogId: 'bible:LSG',
  resourceIdentity: 'bible-text:LSG',
  revision,
  bibleTextSha256: textSha256,
})

const strong = (revision: string, textRevision: string): BiblePublicationSetEntry => ({
  bundlePath: `/baseline/strong-${revision}`,
  catalogId: 'bible-strong:LSG',
  resourceIdentity: 'strong-bible-index:LSG',
  revision,
  bibleDependency: {
    resourceIdentity: 'bible-text:LSG',
    revision: textRevision,
    textSha256: `${textRevision}-sha`,
  },
})

describe('Bible publication set', () => {
  it('rejects a changed Bible while its Strong sidecar still targets the old text', () => {
    assert.throws(
      () =>
        resolveBiblePublicationOverlay(
          [bible('old', 'old-sha'), strong('strong-old', 'old')],
          [bible('new', 'new-sha')],
          'LSG',
          2
        ),
      /BIBLE_PUBLICATION_DEPENDENT_REBUILD_REQUIRED:bible-strong:LSG/
    )
  })

  it('replaces the Bible and its rebuilt dependent while retaining the exhaustive baseline', () => {
    const candidateBible = bible('new', 'new-sha')
    candidateBible.bundlePath = '/candidate/bible'
    const candidateStrong = strong('strong-new', 'new')
    candidateStrong.bundlePath = '/candidate/strong'

    const result = resolveBiblePublicationOverlay(
      [bible('old', 'old-sha'), strong('strong-old', 'old')],
      [candidateBible, candidateStrong],
      'LSG',
      2
    )

    assert.deepEqual(result.changedCatalogIds, ['bible-strong:LSG', 'bible:LSG'])
    assert.deepEqual(result.bundlePaths, ['/candidate/strong', '/candidate/bible'])
    assert.deepEqual(result.previousBundlePaths, [
      '/baseline/strong-strong-old',
      '/baseline/bible-old',
    ])
  })
})
