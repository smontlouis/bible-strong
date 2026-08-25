import { getAnnotationInlineAnchorKey } from '../annotationInlineModel'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

const annotations: WordAnnotationsObj = {
  annotation1: {
    id: 'annotation1',
    version: 'LSG',
    ranges: [{ verseKey: '1-1-1', startWordIndex: 1, endWordIndex: 2, text: 'la terre' }],
    color: 'color1',
    type: 'underline',
    date: 1,
  },
}

const getKey = (
  relationItemsByAnnotation: Record<string, readonly unknown[]>,
  wordAnnotations = annotations
) =>
  getAnnotationInlineAnchorKey({
    wordAnnotations,
    relationItemsByAnnotation,
    version: 'LSG',
    relationsAreInline: true,
    tagsAreInline: true,
  })

describe('getAnnotationInlineAnchorKey', () => {
  it('stays stable when relation props are recreated without moving the inline anchor', () => {
    expect(getKey({ annotation1: [{ label: 'Étude' }] })).toBe(
      getKey({ annotation1: [{ label: 'Étude modifiée' }, { label: 'Strong' }] })
    )
  })

  it('changes when the annotation anchor moves', () => {
    expect(getKey({ annotation1: [{}] })).not.toBe(
      getKey(
        { annotation1: [{}] },
        {
          annotation1: {
            ...annotations.annotation1,
            ranges: [
              { verseKey: '1-1-2', startWordIndex: 4, endWordIndex: 5, text: 'nouvel ancrage' },
            ],
          },
        }
      )
    )
  })
})
