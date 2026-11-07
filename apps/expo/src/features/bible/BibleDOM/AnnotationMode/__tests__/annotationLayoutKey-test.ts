import type { WordAnnotation, WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { getWordAnnotationsLayoutKey } from '../annotationLayoutKey'

const annotation: WordAnnotation = {
  id: 'a',
  version: 'LSG',
  ranges: [{ verseKey: '1-1-2', startWordIndex: 3, endWordIndex: 4, text: 'au-dessus des' }],
  color: 'color1',
  type: 'circle',
  date: 1,
}

const keyOf = (changes: Partial<WordAnnotation>) =>
  getWordAnnotationsLayoutKey({ a: { ...annotation, ...changes } })

describe('getWordAnnotationsLayoutKey', () => {
  it('changes with the color of an annotation, its creation date kept', () => {
    expect(keyOf({ color: 'color2' })).not.toBe(keyOf({}))
  })

  it('changes with the mark of an annotation, its creation date kept', () => {
    expect(keyOf({ type: 'underline' })).not.toBe(keyOf({}))
  })

  it('changes with the words an annotation marks', () => {
    expect(
      keyOf({
        ranges: [
          { verseKey: '1-1-2', startWordIndex: 3, endWordIndex: 5, text: 'au-dessus des eaux' },
        ],
      })
    ).not.toBe(keyOf({}))
    expect(keyOf({ version: 'DBY' })).not.toBe(keyOf({}))
  })

  it('stays the same for what the layer does not draw', () => {
    expect(keyOf({ date: 2, noteId: 'note', tags: {} })).toBe(keyOf({}))
  })

  it('does not depend on the order of the annotations', () => {
    const other: WordAnnotation = { ...annotation, id: 'b', color: 'color3' }
    const forward: WordAnnotationsObj = { a: annotation, b: other }
    const backward: WordAnnotationsObj = { b: other, a: annotation }
    expect(getWordAnnotationsLayoutKey(forward)).toBe(getWordAnnotationsLayoutKey(backward))
  })

  it('is empty without annotations', () => {
    expect(getWordAnnotationsLayoutKey(undefined)).toBe('')
    expect(getWordAnnotationsLayoutKey({})).toBe('')
  })
})
