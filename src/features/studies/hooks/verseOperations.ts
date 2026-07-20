import type { Study } from '~redux/modules/user'

export interface StudyVerseData {
  [key: string]: string | string[]
  title: string
  content: string
  version: string
  verses: string[]
}

export type StudyVerseFormat = 'inline' | 'block'

type QuillDeltaOperations = NonNullable<Study['content']>['ops']

export const createVerseOperations = (
  verseData: StudyVerseData,
  format: StudyVerseFormat
): QuillDeltaOperations => {
  if (format === 'inline') {
    return [
      {
        insert: verseData.title,
        attributes: {
          'inline-verse': {
            title: verseData.title,
            version: verseData.version,
            verses: verseData.verses,
          },
        },
      },
      { insert: ' ' },
    ]
  }

  return [
    {
      insert: {
        'block-verse': verseData,
      },
    },
    { insert: '\n' },
  ]
}
