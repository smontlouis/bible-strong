import { performance } from 'node:perf_hooks'

import type { HighlightsObj } from '~redux/modules/user'
import { buildGroupedHighlights } from '../highlightsQuery'

describe('highlight list query', () => {
  it('filters and groups verse highlights by creation date', () => {
    const highlights: HighlightsObj = {
      '1-1-2': {
        color: 'yellow',
        date: 20,
        version: 'LSG',
        tags: { grace: { id: 'grace', name: 'Grâce' } },
      },
      '1-1-1': {
        color: 'yellow',
        date: 20,
        version: 'LSG',
        tags: { faith: { id: 'faith', name: 'Foi' } },
      },
      '40-1-1': { color: 'blue', date: 10, version: 'KJV' },
    }

    const groups = buildGroupedHighlights(highlights, {
      colorId: 'yellow',
      testament: 'old',
    })

    expect(groups).toEqual([
      {
        date: 20,
        color: 'yellow',
        version: 'LSG',
        highlightsObj: [
          { Livre: 1, Chapitre: 1, Verset: 1, Texte: '' },
          { Livre: 1, Chapitre: 1, Verset: 2, Texte: '' },
        ],
        stringIds: { '1-1-2': true, '1-1-1': true },
        tags: {
          grace: { id: 'grace', name: 'Grâce' },
          faith: { id: 'faith', name: 'Foi' },
        },
      },
    ])
  })

  it('builds 3,267 separate highlight groups within the list preparation budget', () => {
    const highlights = Object.fromEntries(
      Array.from({ length: 3267 }, (_, index) => {
        const book = Math.floor(index / (31 * 30)) + 1
        const chapter = (Math.floor(index / 31) % 30) + 1
        const verse = (index % 31) + 1
        return [`${book}-${chapter}-${verse}`, { color: 'yellow', date: index, tags: {} }]
      })
    ) as HighlightsObj

    const start = performance.now()
    const groups = buildGroupedHighlights(highlights, {})
    const duration = performance.now() - start

    expect(groups).toHaveLength(3267)
    expect(duration).toBeLessThan(100)
  })
})
