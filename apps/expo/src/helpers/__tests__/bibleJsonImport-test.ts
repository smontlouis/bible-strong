import { countImportableBibleVerses } from '../bibleJsonImport'

describe('Bible JSON import policy', () => {
  it('counts only numeric verse entries that the SQLite importer can store', () => {
    expect(
      countImportableBibleVerses({
        '1': {
          '1': {
            '1': 'In the beginning',
            '12a': 'Variant verse',
            '2': 'The earth was formless',
            '20+NUM': 'Source-specific duplicate',
          },
        },
      })
    ).toBe(2)
  })
})
