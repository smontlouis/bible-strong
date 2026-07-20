import {
  getBibleLocationVerseKeys,
  getBibleVerseResolutionRequestKey,
  resolveBibleVerses,
  shouldShowBibleReferenceUnavailable,
} from '../bibleVerseResolver'

jest.mock('../biblesDb', () => ({
  getInstalledVersions: jest.fn(),
  getMultipleVerses: jest.fn(),
}))

describe('resolveBibleVerses', () => {
  const createDependencies = (textsByVersion: Record<string, Record<string, string>>) => ({
    getInstalledVersions: jest.fn(async () => Object.keys(textsByVersion)),
    getMultipleVerses: jest.fn(async (version: string, verseKeys: string[]) =>
      Object.fromEntries(
        verseKeys
          .filter(key => textsByVersion[version]?.[key])
          .map(key => [key, textsByVersion[version][key]])
      )
    ),
  })

  it('uses the preferred source version before the default version', async () => {
    const dependencies = createDependencies({
      LSG: { '1-1-1': 'LSG text' },
      VUL: { '1-1-1': 'VUL text' },
    })

    await expect(
      resolveBibleVerses(
        {
          verseKeys: ['1-1-1'],
          preferredVersion: 'VUL',
          defaultVersion: 'LSG',
        },
        dependencies
      )
    ).resolves.toMatchObject({
      version: 'VUL',
      texts: { '1-1-1': 'VUL text' },
      missingVerseKeys: [],
    })
  })

  it('falls back to an installed compatible Bible for a deuterocanonical verse', async () => {
    const dependencies = createDependencies({
      LSG: {},
      VUL: { '67-1-1': 'Tobiae text' },
    })

    await expect(
      resolveBibleVerses(
        {
          verseKeys: ['67-1-1'],
          defaultVersion: 'LSG',
        },
        dependencies
      )
    ).resolves.toMatchObject({
      status: 'resolved',
      version: 'VUL',
      texts: { '67-1-1': 'Tobiae text' },
      missingVerseKeys: [],
    })
  })

  it('returns a reference-only result when no installed Bible contains the verse', async () => {
    const dependencies = createDependencies({ LSG: {}, KJV: {} })

    await expect(
      resolveBibleVerses(
        {
          verseKeys: ['67-1-1'],
          defaultVersion: 'LSG',
        },
        dependencies
      )
    ).resolves.toEqual({
      status: 'reference-only',
      version: undefined,
      texts: {},
      missingVerseKeys: ['67-1-1'],
    })
  })

  it('keeps the best partial result without hiding the entity', async () => {
    const dependencies = createDependencies({
      LSG: {},
      VUL: { '67-1-1': 'One verse' },
    })

    await expect(
      resolveBibleVerses(
        {
          verseKeys: ['67-1-1', '67-1-2'],
          defaultVersion: 'LSG',
        },
        dependencies
      )
    ).resolves.toEqual({
      status: 'partial',
      version: 'VUL',
      texts: { '67-1-1': 'One verse' },
      missingVerseKeys: ['67-1-2'],
    })
  })
})

describe('getBibleLocationVerseKeys', () => {
  it('checks every focused verse before opening a multi-verse entity', () => {
    expect(
      getBibleLocationVerseKeys({
        book: 67,
        chapter: 1,
        verse: 1,
        focusVerses: [1, 2, 4],
      })
    ).toEqual(['67-1-1', '67-1-2', '67-1-4'])
  })
})

describe('shouldShowBibleReferenceUnavailable', () => {
  it('opens the best installed version when only part of a verse range is available', () => {
    expect(shouldShowBibleReferenceUnavailable('partial')).toBe(false)
  })

  it('shows the download fallback only when no installed Bible contains the reference', () => {
    expect(shouldShowBibleReferenceUnavailable('reference-only')).toBe(true)
  })
})

describe('getBibleVerseResolutionRequestKey', () => {
  it('invalidates stale results when the selected version or installed data changes', () => {
    const baseRequest = {
      verseKeys: ['67-1-1'],
      defaultVersion: 'LSG',
      dataRefreshSignal: 0,
    }
    const initialKey = getBibleVerseResolutionRequestKey({
      ...baseRequest,
      preferredVersion: 'VUL',
    })

    expect(
      getBibleVerseResolutionRequestKey({
        ...baseRequest,
        preferredVersion: 'KJV',
      })
    ).not.toBe(initialKey)
    expect(
      getBibleVerseResolutionRequestKey({
        ...baseRequest,
        preferredVersion: 'VUL',
        dataRefreshSignal: 1,
      })
    ).not.toBe(initialKey)
  })
})
