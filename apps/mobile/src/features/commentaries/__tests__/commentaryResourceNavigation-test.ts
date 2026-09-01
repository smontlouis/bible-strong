import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import {
  getCommentarySectionsForVerse,
  getCommentaryResourceRoute,
  getCoveredCommentaryLocation,
  groupCommentarySectionsForVerse,
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

  it('opens the exact section when it is the only one covering the verse', () => {
    const item: CommentaryVerseAvailability = {
      ...baseItem,
      state: 'verse',
      comment: {
        id: 'barnes-fr-41-1-1',
        sectionId: 'barnes-fr-41-1-1-8',
        verseId: '41-1-1',
        rangeStartVerse: 1,
        rangeEndVerse: 8,
        matchingSectionCount: 1,
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

  it('opens a verse-filtered list when several sections cover the verse', () => {
    const item: CommentaryVerseAvailability = {
      ...baseItem,
      state: 'verse',
      comment: {
        id: 'egw-en-1-1-1',
        sectionId: 'egw-en-1-1-1-1',
        verseId: '1-1-1',
        rangeStartVerse: 1,
        rangeEndVerse: 1,
        matchingSectionCount: 7,
        content: 'Preview',
        resource: {
          name: 'EGW Writings',
          code: 'EGW:en',
          logo: '',
          author: 'Ellen G. White',
        },
        order: 0,
        type: 'comment',
        isSDA: true,
      },
    }

    expect(getCommentaryResourceRoute(item, { book: 1, chapter: 1, verse: 1 })).toEqual({
      pathname: '/commentary-chapter',
      params: {
        projectionId: 'barnes:fr',
        book: '1',
        chapter: '1',
        focusVerse: '1',
      },
    })
  })

  it('keeps the whole current chapter when only another verse has commentary', () => {
    expect(getCommentaryResourceRoute(baseItem, { book: 41, chapter: 1, verse: 1 })).toEqual({
      pathname: '/commentary-chapter',
      params: {
        projectionId: 'barnes:fr',
        book: '41',
        chapter: '1',
      },
    })
  })

  it('filters sections to ranges containing the requested verse', () => {
    const sections = [
      { id: 'one', rangeStartVerse: 1, rangeEndVerse: 1 },
      { id: 'wide', rangeStartVerse: 1, rangeEndVerse: 27 },
      { id: 'other', rangeStartVerse: 2, rangeEndVerse: 2 },
    ]

    expect(getCommentarySectionsForVerse(sections, 1).map(section => section.id)).toEqual([
      'one',
      'wide',
    ])
    expect(getCommentarySectionsForVerse(sections, undefined)).toEqual(sections)
  })

  it('prioritizes narrow matches and separates broad chapter context', () => {
    const exact = { id: 'exact', rangeStartVerse: 4, rangeEndVerse: 4 }
    const short = { id: 'short', rangeStartVerse: 3, rangeEndVerse: 6 }
    const broad = { id: 'broad', rangeStartVerse: 1, rangeEndVerse: 27 }
    const wholeChapter = { id: 'chapter', rangeStartVerse: 1, rangeEndVerse: 31 }
    const unrelated = { id: 'unrelated', rangeStartVerse: 5, rangeEndVerse: 5 }

    expect(
      groupCommentarySectionsForVerse({
        sections: [wholeChapter, short, unrelated, broad, exact],
        verse: 4,
        chapterVerseCount: 31,
      })
    ).toEqual({
      directSections: [exact, short],
      chapterContextSections: [broad, wholeChapter],
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
