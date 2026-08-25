import { createVerseOperations } from '../verseOperations'

const verseData = {
  title: 'Tobie 1:1',
  content: 'Verbum Tobiae',
  version: 'VUL',
  verses: ['67-1-1'],
}

describe('createVerseOperations', () => {
  it('stores the source version in an inline verse', () => {
    expect(createVerseOperations(verseData, 'inline')).toEqual([
      {
        insert: 'Tobie 1:1',
        attributes: {
          'inline-verse': {
            title: 'Tobie 1:1',
            version: 'VUL',
            verses: ['67-1-1'],
          },
        },
      },
      { insert: ' ' },
    ])
  })

  it('stores the source version in a block verse', () => {
    expect(createVerseOperations(verseData, 'block')[0]).toEqual({
      insert: {
        'block-verse': verseData,
      },
    })
  })
})
