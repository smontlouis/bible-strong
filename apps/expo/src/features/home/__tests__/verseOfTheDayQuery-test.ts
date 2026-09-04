import { getVerseOfTheDayPrefetchOffsets, getVerseOfTheDayQueryKey } from '../verseOfTheDayPolicy'

describe('verse of the day prefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('prefetches the five visible carousel days', () => {
    expect(getVerseOfTheDayPrefetchOffsets(false)).toEqual([-4, -3, -2, -1, 0])
  })

  it('also prefetches tomorrow when notifications are enabled', () => {
    expect(getVerseOfTheDayPrefetchOffsets(true)).toEqual([-4, -3, -2, -1, 0, 1])
  })

  it('uses the same stable query key for consumers and prefetching', () => {
    expect(getVerseOfTheDayQueryKey('LSG', 0)).toEqual(['verse-of-the-day', 'LSG', 248])
  })
})
