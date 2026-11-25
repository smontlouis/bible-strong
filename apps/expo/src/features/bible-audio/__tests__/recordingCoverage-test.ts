import type { BibleAudioRecording } from '../audioCatalog'
import { getRecordingCoverage } from '../recordingCoverage'

jest.mock('../audioCatalog', () => ({}))

const recording = (books?: number[]) =>
  ({
    id: 'r',
    version: 'LSG',
    kind: 'reading',
    sources: [],
    books,
  }) as unknown as BibleAudioRecording

const range = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index)

describe('getRecordingCoverage', () => {
  it('says nothing of a recording of the whole Bible', () => {
    expect(getRecordingCoverage(recording())).toEqual({ kind: 'all' })
  })

  it('names a testament covered exactly', () => {
    expect(getRecordingCoverage(recording(range(40, 66)))).toEqual({
      kind: 'testament',
      testament: 'new',
    })
    expect(getRecordingCoverage(recording(range(1, 39)))).toEqual({
      kind: 'testament',
      testament: 'old',
    })
  })

  it('names a few books in the order of the Bible, and counts more', () => {
    expect(getRecordingCoverage(recording([43, 20]))).toEqual({ kind: 'books', books: [20, 43] })
    expect(getRecordingCoverage(recording(range(1, 12)))).toEqual({ kind: 'count', count: 12 })
  })
})
