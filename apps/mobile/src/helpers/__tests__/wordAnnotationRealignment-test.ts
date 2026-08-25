import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { planWordAnnotationRealignment } from '../wordAnnotationRealignment'

const annotation = (
  ranges: WordAnnotationsObj[string]['ranges'],
  textRevision = 'old',
  version: WordAnnotationsObj[string]['version'] = 'LSG'
): WordAnnotationsObj[string] => ({
  id: 'annotation-1',
  version,
  ranges,
  color: 'color1',
  type: 'background',
  date: 1,
  textRevision,
  tags: { tag: { id: 'tag', name: 'Tag' } },
  noteId: 'note-1',
})

describe('word annotation realignment', () => {
  it('accepts typographic whitespace changes without moving the range', () => {
    const annotations = {
      'annotation-1': annotation([
        {
          verseKey: '1-1-1',
          startWordIndex: 0,
          endWordIndex: 1,
          text: 'Dieu dit :',
        },
      ]),
    }

    expect(
      planWordAnnotationRealignment({
        annotations,
        version: 'LSG',
        textRevision: 'new',
        candidateVerses: { '1-1-1': 'Dieu dit\u00a0: lumière.' },
      }).updates
    ).toEqual({
      'annotation-1': expect.objectContaining({
        textRevision: 'new',
        ranges: annotations['annotation-1'].ranges,
      }),
    })
  })

  it('moves a range when the saved text has one deterministic match', () => {
    const annotations = {
      'annotation-1': annotation([
        {
          verseKey: '1-1-1',
          startWordIndex: 1,
          endWordIndex: 1,
          text: 'lumière',
        },
      ]),
    }

    const result = planWordAnnotationRealignment({
      annotations,
      version: 'LSG',
      textRevision: 'new',
      candidateVerses: { '1-1-1': 'Au commencement Dieu créa la lumière.' },
    })

    expect(result.updates['annotation-1']?.ranges[0]).toEqual({
      ...annotations['annotation-1'].ranges[0],
      startWordIndex: 5,
      endWordIndex: 5,
    })
    expect(result.realignedRangeCount).toBe(1)
  })

  it('leaves an ambiguous annotation completely unchanged and visible normally', () => {
    const existing = annotation([
      {
        verseKey: '1-1-1',
        startWordIndex: 0,
        endWordIndex: 0,
        text: 'Dieu',
      },
    ])
    const result = planWordAnnotationRealignment({
      annotations: { 'annotation-1': existing },
      version: 'LSG',
      textRevision: 'new',
      candidateVerses: { '1-1-1': 'Au Dieu vivant, Dieu fidèle.' },
    })

    expect(result.updates).toEqual({})
    expect(result.unchangedAmbiguousAnnotationIds).toEqual(['annotation-1'])
    expect(existing).toEqual(
      expect.objectContaining({
        ranges: [
          expect.objectContaining({
            startWordIndex: 0,
            endWordIndex: 0,
          }),
        ],
        textRevision: 'old',
      })
    )
  })

  it('is idempotent once an annotation is validated against the revision', () => {
    const existing = annotation(
      [
        {
          verseKey: '1-1-1',
          startWordIndex: 0,
          endWordIndex: 0,
          text: 'Dieu',
        },
      ],
      'new'
    )

    expect(
      planWordAnnotationRealignment({
        annotations: { 'annotation-1': existing },
        version: 'LSG',
        textRevision: 'new',
        candidateVerses: { '1-1-1': 'Dieu créa.' },
      }).updates
    ).toEqual({})
  })

  it('moves deterministic ranges while leaving an ambiguous range at its previous position', () => {
    const existing = annotation([
      {
        verseKey: '1-1-1',
        startWordIndex: 0,
        endWordIndex: 0,
        text: 'lumière',
      },
      {
        verseKey: '1-1-2',
        startWordIndex: 1,
        endWordIndex: 1,
        text: 'Dieu',
      },
    ])

    const result = planWordAnnotationRealignment({
      annotations: { 'annotation-1': existing },
      version: 'LSG',
      textRevision: 'new',
      candidateVerses: {
        '1-1-1': 'Et Dieu créa la lumière.',
        '1-1-2': 'Dieu parla, puis Dieu répondit.',
      },
    })

    expect(result.updates['annotation-1']).toEqual({
      ranges: [
        expect.objectContaining({
          verseKey: '1-1-1',
          startWordIndex: 4,
          endWordIndex: 4,
        }),
        existing.ranges[1],
      ],
      textRevision: 'old',
    })
    expect(result.realignedRangeCount).toBe(1)
    expect(result.unchangedAmbiguousAnnotationIds).toEqual(['annotation-1'])
  })

  it('can use the matching version history to disambiguate repeated text', () => {
    const existing = annotation([
      {
        verseKey: '1-1-1',
        startWordIndex: 2,
        endWordIndex: 2,
        text: 'Dieu',
      },
    ])

    const result = planWordAnnotationRealignment({
      annotations: { 'annotation-1': existing },
      version: 'LSG',
      textRevision: 'new',
      candidateVerses: { '1-1-1': 'Au Dieu fidèle puis le Dieu vivant est.' },
      previousVersesByVersion: {
        LSG: { '1-1-1': 'Le vrai Dieu vivant est fidèle.' },
      },
    })

    expect(result.updates['annotation-1']?.ranges[0]).toEqual(
      expect.objectContaining({ startWordIndex: 5, endWordIndex: 5 })
    )
  })
})
