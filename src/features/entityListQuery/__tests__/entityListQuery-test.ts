import { queryEntityList } from '../entityListQuery'

const rows = [
  { id: 'b', title: 'Ésaïe', description: 'prophète', date: 20, createdAt: 10 },
  { id: 'a', title: 'Genèse', description: 'commencement', date: 10, createdAt: 20 },
]

describe('queryEntityList', () => {
  it('reuses accent-insensitive global fuzzy search then applies the selected sort', () => {
    expect(
      queryEntityList(rows, { query: 'esaie', sort: 'title-desc' }).map(row => row.id)
    ).toEqual(['b'])
  })

  it('supports stable date and title ordering', () => {
    expect(queryEntityList(rows, { query: '', sort: 'oldest' }).map(row => row.id)).toEqual([
      'a',
      'b',
    ])
    expect(queryEntityList(rows, { query: '', sort: 'created-newest' }).map(row => row.id)).toEqual(
      ['a', 'b']
    )
  })
})
