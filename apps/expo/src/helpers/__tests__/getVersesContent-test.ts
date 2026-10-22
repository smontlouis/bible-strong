/* eslint-disable import/first */
const mockWarn = jest.fn()
const mockCaptureError = jest.fn()

jest.mock('~helpers/agentObservability', () => ({
  appLogger: {
    warn: (...args: unknown[]) => mockWarn(...args),
    captureError: (...args: unknown[]) => mockCaptureError(...args),
  },
}))
jest.mock('../verseToReference', () => ({
  __esModule: true,
  default: () => 'Genèse 1:1-3',
}))

import getVersesContent from '../getVersesContent'

const verses = { '1-1-1': true, '1-1-2': true, '1-1-3': true } as const

describe('getVersesContent', () => {
  beforeEach(() => {
    mockWarn.mockClear()
    mockCaptureError.mockClear()
  })

  it('leaves out only a verse the version lacks, and keeps the quotes around the others', async () => {
    const { content } = await getVersesContent({
      verses,
      version: 'KJF',
      hasQuotes: true,
      hasVerseNumbers: true,
      loadVerseTexts: async () => ({ '1-1-1': 'Au commencement', '1-1-3': 'Que la lumière soit' }),
    })

    expect(content).toBe('« 1. Au commencement 3. Que la lumière soit »\n ')
    expect(mockWarn).toHaveBeenCalledWith(
      'database',
      'verse_content.missing',
      expect.objectContaining({ missingVerses: ['1-1-2'] })
    )
    expect(mockCaptureError).not.toHaveBeenCalled()
  })

  it('reports a selection none of whose verses could be loaded', async () => {
    const { content } = await getVersesContent({
      verses,
      version: 'BHG',
      loadVerseTexts: async () => ({ '1-1-1': '' }),
    })

    expect(content).toBe('Impossible de charger ce verset.')
    expect(mockCaptureError).toHaveBeenCalledTimes(1)
  })
})
