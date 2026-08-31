import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import {
  getCommentaryResourceRoute,
  getCoveredCommentaryLocation,
} from '../commentaryResourceNavigation'
import type { CommentaryVerseAvailability } from '../commentaryVerseAvailability'

const baseItem: CommentaryVerseAvailability = {
  projectionId: 'barnes:fr',
  entry: COMMENTARY_CATALOG_BY_ID.get('barnes')!,
  language: 'fr',
  resourceCode: 'barnes:fr',
  state: 'chapter',
}

describe('commentary resource navigation', () => {
  it('keeps a covered location and otherwise selects the first available chapter', () => {
    const coverage = { books: [19, 41], chaptersByBook: { 19: [1, 3], 41: [1] } }

    expect(getCoveredCommentaryLocation(coverage, { book: 19, chapter: 3 })).toEqual({
      book: 19,
      chapter: 3,
    })
    expect(getCoveredCommentaryLocation(coverage, { book: 1, chapter: 1 })).toEqual({
      book: 19,
      chapter: 1,
    })
  })

  it('opens the exact section when the commentary covers the verse', () => {
    const item: CommentaryVerseAvailability = {
      ...baseItem,
      state: 'verse',
      comment: {
        id: 'barnes-fr-41-1-1',
        sectionId: 'barnes-fr-41-1-1-8',
        verseId: '41-1-1',
        rangeStartVerse: 1,
        rangeEndVerse: 8,
        content: 'Preview',
        resource: {
          name: 'Barnes',
          code: 'barnes:fr',
          logo: '',
          author: 'Albert Barnes',
        },
        order: 0,
        type: 'comment',
        isSDA: false,
      },
    }

    expect(getCommentaryResourceRoute(item, { book: 41, chapter: 1, verse: 1 })).toEqual({
      pathname: '/commentary-entry',
      params: {
        projectionId: 'barnes:fr',
        book: '41',
        chapter: '1',
        sectionId: 'barnes-fr-41-1-1-8',
      },
    })
  })

  it('keeps the current chapter when another verse has commentary', () => {
    expect(getCommentaryResourceRoute(baseItem, { book: 41, chapter: 1, verse: 1 })).toEqual({
      pathname: '/commentary-chapter',
      params: {
        projectionId: 'barnes:fr',
        book: '41',
        chapter: '1',
        focusVerse: '1',
      },
    })
  })

  it('falls back to Genesis 1 when the current chapter has no content', () => {
    expect(
      getCommentaryResourceRoute(
        { ...baseItem, state: 'no-content' },
        { book: 41, chapter: 1, verse: 1 }
      )
    ).toEqual({
      pathname: '/commentary-chapter',
      params: { projectionId: 'barnes:fr', book: '1', chapter: '1' },
    })
  })

  it('does not navigate when the resource is unavailable', () => {
    expect(
      getCommentaryResourceRoute(
        { ...baseItem, state: 'unavailable' },
        { book: 41, chapter: 1, verse: 1 }
      )
    ).toBeUndefined()
  })
})
