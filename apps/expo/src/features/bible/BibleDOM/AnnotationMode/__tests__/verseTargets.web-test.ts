/** @jest-environment jsdom */

import {
  createVerseCellKey,
  findVerseTextElements,
  getVerseTarget,
  isSameVerseColumn,
} from '../verseTargets'

// The same version shown in the first and third columns of a parallel reading
const renderParallelVerse = () => {
  document.body.innerHTML = `
    <span data-verse-text data-version="NKJV" data-verse-key="44-27-2" data-column="0">So</span>
    <span data-verse-text data-version="NET" data-verse-key="44-27-2" data-column="1">We</span>
    <span data-verse-text data-version="NKJV" data-verse-key="44-27-2" data-column="2">So</span>
  `
  return Array.from(document.querySelectorAll('[data-verse-text]'))
}

describe('Bible DOM verse targets', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reads the column a verse is shown in', () => {
    const [, , thirdColumn] = renderParallelVerse()

    expect(getVerseTarget(thirdColumn)).toEqual({
      verseKey: '44-27-2',
      version: 'NKJV',
      column: 2,
    })
  })

  it('leaves the column out outside parallel reading', () => {
    document.body.innerHTML =
      '<span data-verse-text data-version="NKJV" data-verse-key="44-27-2">So</span>'

    expect(getVerseTarget(document.querySelector('[data-verse-text]'))).toStrictEqual({
      verseKey: '44-27-2',
      version: 'NKJV',
    })
  })

  it('finds a version in every column, or in the one asked for', () => {
    const [firstColumn, , thirdColumn] = renderParallelVerse()

    expect(findVerseTextElements('NKJV', '44-27-2')).toEqual([firstColumn, thirdColumn])
    expect(findVerseTextElements('NKJV', '44-27-2', 2)).toEqual([thirdColumn])
  })

  it('tells two columns of the same version apart', () => {
    const first = { verseKey: '44-27-2', version: 'NKJV', column: 0 }
    const third = { verseKey: '44-27-2', version: 'NKJV', column: 2 }

    expect(isSameVerseColumn(first, third)).toBe(false)
    expect(isSameVerseColumn(first, { ...first })).toBe(true)
    expect(createVerseCellKey(first)).not.toBe(createVerseCellKey(third))
  })
})
