import type { EntitySlice } from '~common/types'
import { getPlanEntityRoute } from '../planEntityRoute'

const route = (slice: EntitySlice) =>
  getPlanEntityRoute({ planId: 'plan', readingSliceId: 'day-1', entitySliceId: 'element', slice })

describe('getPlanEntityRoute', () => {
  it('opens a passage of several chapters in plan mode, bounded by its last chapter', () => {
    expect(route({ type: 'Chapter', id: 'a', chapters: '1|1-3' })).toEqual({
      pathname: '/bible-view',
      params: { book: '1', chapter: '1', planEndChapter: '3' },
    })
  })

  it('bounds a single chapter to itself', () => {
    expect(route({ type: 'Chapter', id: 'a', chapters: '66|22' })?.params).toEqual({
      book: '66',
      chapter: '22',
      planEndChapter: '22',
    })
  })

  it('opens verses focused on the whole range, within their chapter', () => {
    expect(route({ type: 'Verse', verses: '13|1:1-4' })?.params).toEqual({
      book: '13',
      chapter: '1',
      verse: '1',
      focusVerses: '[1,2,3,4]',
      contextDisplayMode: 'focused',
      planEndChapter: '1',
    })
    expect(route({ type: 'Verse', verses: '1|11:32' })?.params.focusVerses).toBe('[32]')
  })

  it('gives a text, an image and a video their own page', () => {
    const page = {
      pathname: '/plan-entity',
      params: { planId: 'plan', readingSliceId: 'day-1', entitySliceId: 'element' },
    }

    expect(route({ type: 'Text', id: 'a', description: 'Méditation' })).toEqual(page)
    expect(route({ type: 'Image', id: 'a', src: 'cover' })).toEqual(page)
    expect(route({ type: 'Video', id: 'a', title: 'Vidéo', url: 'https://example.com' })).toEqual(
      page
    )
  })

  it('opens nothing for a title or a passage it cannot read', () => {
    expect(route({ type: 'Title', id: 'a', title: 'Lecture' })).toBeUndefined()
    expect(route({ type: 'Chapter', id: 'a', chapters: '1|3-1' })).toBeUndefined()
    expect(route({ type: 'Verse', verses: 'Gen 1:1' })).toBeUndefined()
  })
})
