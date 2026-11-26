jest.mock('../dailyReadingStore', () => ({
  readKeptCollection: jest.fn(),
  downloadCollection: jest.fn(),
}))
jest.mock('~helpers/atomWithAsyncStorage', () => {
  const { atom } = jest.requireActual('jotai')
  return { __esModule: true, default: (_key: string, initial: unknown) => atom(initial) }
})

import { downloadCollection, readKeptCollection } from '../dailyReadingStore'
import { DailyReadingUnavailable, loadDailyCollection } from '../useDailyReadings'

const file = (prayer: string) =>
  JSON.stringify({
    format: 'bible-strong-daily-readings',
    version: 1,
    id: '365j',
    kind: 'devotional-book',
    language: 'fr',
    calendar: { '01-01': '1' },
    entries: { '1': { scene: 'a', cards: [{ type: 'text', text: prayer }] } },
  })

const kept = jest.mocked(readKeptCollection)
const download = jest.mocked(downloadCollection)
const firstText = (collection: Awaited<ReturnType<typeof loadDailyCollection>>) =>
  (collection.entries['1'].cards[0] as { text: string }).text

beforeEach(() => {
  kept.mockReset()
  download.mockReset()
})

describe('loadDailyCollection', () => {
  it('reads the kept copy while it is the current one', async () => {
    kept.mockResolvedValue({ hash: 'aaaaaaaaaaaa', text: file('kept') })
    expect(firstText(await loadDailyCollection('365j', 'aaaaaaaaaaaa'))).toBe('kept')
    expect(download).not.toHaveBeenCalled()
  })

  it('reads the kept copy while the catalog is unknown', async () => {
    kept.mockResolvedValue({ hash: 'aaaaaaaaaaaa', text: file('kept') })
    expect(firstText(await loadDailyCollection('365j', undefined))).toBe('kept')
  })

  it('downloads the current file when the copy is older', async () => {
    kept.mockResolvedValue({ hash: 'aaaaaaaaaaaa', text: file('kept') })
    download.mockResolvedValue(file('fresh'))
    expect(firstText(await loadDailyCollection('365j', 'bbbbbbbbbbbb'))).toBe('fresh')
    expect(download).toHaveBeenCalledWith('365j', 'bbbbbbbbbbbb')
  })

  it('keeps reading the old copy when the download fails', async () => {
    kept.mockResolvedValue({ hash: 'aaaaaaaaaaaa', text: file('kept') })
    download.mockRejectedValue(new Error('offline'))
    expect(firstText(await loadDailyCollection('365j', 'bbbbbbbbbbbb'))).toBe('kept')
  })

  it('fails without a copy or a catalog', async () => {
    kept.mockResolvedValue(undefined)
    await expect(loadDailyCollection('365j', undefined)).rejects.toBeInstanceOf(
      DailyReadingUnavailable
    )
  })

  it('downloads again over a damaged copy', async () => {
    kept.mockResolvedValue({ hash: 'aaaaaaaaaaaa', text: '{"broken"' })
    download.mockResolvedValue(file('fresh'))
    expect(firstText(await loadDailyCollection('365j', 'aaaaaaaaaaaa'))).toBe('fresh')
  })
})
