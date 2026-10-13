import {
  canGoToNextPlanChapter,
  canGoToPreviousPlanChapter,
  getPlanPassagePosition,
  isInPlanPassage,
} from '../planPassage'

const genesis1to3 = { book: 1, startChapter: 1, endChapter: 3 }

describe('plan passage', () => {
  it('lets the reader move between the chapters of the passage, not beyond', () => {
    expect(canGoToPreviousPlanChapter(genesis1to3, { book: 1, chapter: 1 })).toBe(false)
    expect(canGoToNextPlanChapter(genesis1to3, { book: 1, chapter: 1 })).toBe(true)
    expect(canGoToPreviousPlanChapter(genesis1to3, { book: 1, chapter: 2 })).toBe(true)
    expect(canGoToNextPlanChapter(genesis1to3, { book: 1, chapter: 2 })).toBe(true)
    expect(canGoToPreviousPlanChapter(genesis1to3, { book: 1, chapter: 3 })).toBe(true)
    expect(canGoToNextPlanChapter(genesis1to3, { book: 1, chapter: 3 })).toBe(false)
  })

  it('offers no chapter navigation for a passage of one chapter', () => {
    const psalm1 = { book: 19, startChapter: 1, endChapter: 1 }

    expect(canGoToPreviousPlanChapter(psalm1, { book: 19, chapter: 1 })).toBe(false)
    expect(canGoToNextPlanChapter(psalm1, { book: 19, chapter: 1 })).toBe(false)
    expect(getPlanPassagePosition(psalm1, 1)).toBeUndefined()
  })

  it('leaves the reader free outside plan mode', () => {
    expect(canGoToPreviousPlanChapter(undefined, { book: 1, chapter: 1 })).toBe(true)
    expect(canGoToNextPlanChapter(undefined, { book: 66, chapter: 22 })).toBe(true)
    expect(isInPlanPassage(undefined, { book: 40, chapter: 5 })).toBe(true)
  })

  it('refuses a jump to a chapter or a book outside the passage', () => {
    expect(isInPlanPassage(genesis1to3, { book: 1, chapter: 2 })).toBe(true)
    expect(isInPlanPassage(genesis1to3, { book: 1, chapter: 4 })).toBe(false)
    expect(isInPlanPassage(genesis1to3, { book: 2, chapter: 2 })).toBe(false)
  })

  it('tells where the reader stands in a passage of several chapters', () => {
    expect(getPlanPassagePosition(genesis1to3, 2)).toEqual({ current: 2, total: 3 })
    expect(getPlanPassagePosition(genesis1to3, 4)).toBeUndefined()
  })
})
