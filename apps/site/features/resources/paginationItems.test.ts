import { describe, expect, it } from 'vitest'
import { paginationItems } from './paginationItems'

describe('paginationItems', () => {
  it('lists every page of a short pagination', () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the first, the last and the neighbours of the current page', () => {
    expect(paginationItems(1, 45)).toEqual([1, 2, 3, 'gap', 45])
    expect(paginationItems(20, 45)).toEqual([1, 'gap', 18, 19, 20, 21, 22, 'gap', 45])
    expect(paginationItems(45, 45)).toEqual([1, 'gap', 43, 44, 45])
  })

  it('shows a single missing page instead of a gap', () => {
    expect(paginationItems(4, 45)).toEqual([1, 2, 3, 4, 5, 6, 'gap', 45])
    expect(paginationItems(42, 45)).toEqual([1, 'gap', 40, 41, 42, 43, 44, 45])
  })
})
