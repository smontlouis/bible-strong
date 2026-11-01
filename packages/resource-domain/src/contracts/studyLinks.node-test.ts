import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readStudyLinks, type StudyLinkRow } from './studyLinksContract'

const row = (overrides: Partial<StudyLinkRow>): StudyLinkRow => ({
  kind: 'timeline',
  key: 'key',
  label_fr: 'Libellé',
  label_en: 'Label',
  detail_fr: null,
  detail_en: null,
  language: null,
  position: null,
  role: null,
  ...overrides,
})

describe('study links', () => {
  it('prints the language of the reader', () => {
    assert.deepEqual(
      readStudyLinks('nave', 'en', [row({ detail_fr: 'Détail', detail_en: 'Detail' })]),
      [{ kind: 'timeline', key: 'key', label: 'Label', detail: 'Detail' }]
    )
  })

  it('keeps a person only named by an event on the event', () => {
    const mentioned = row({ role: 'mentioned' })
    assert.equal(readStudyLinks('entity', 'fr', [mentioned]).length, 0)
    assert.equal(readStudyLinks('timeline', 'fr', [mentioned]).length, 1)
  })

  it('shows a dictionary article in its own language only', () => {
    const article = row({ kind: 'dictionary', language: 'fr' })
    assert.equal(readStudyLinks('entity', 'fr', [article]).length, 1)
    assert.equal(readStudyLinks('entity', 'en', [article]).length, 0)
  })

  it('reads events in the order of time', () => {
    const labels = readStudyLinks('entity', 'fr', [
      row({ key: 'b', label_fr: 'Absalom', position: -970 }),
      row({ key: 'a', label_fr: 'Bethléhem', position: -1040 }),
    ]).map(({ label }) => label)
    assert.deepEqual(labels, ['Bethléhem', 'Absalom'])
  })

  it('orders people first, then topics, articles and events', () => {
    const kinds = readStudyLinks('nave', 'fr', [
      row({ kind: 'timeline' }),
      row({ kind: 'dictionary', language: 'fr' }),
      row({ kind: 'entity' }),
    ]).map(({ kind }) => kind)
    assert.deepEqual(kinds, ['entity', 'dictionary', 'timeline'])
  })
})
