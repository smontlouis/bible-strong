/* eslint-disable import/first */

jest.mock('~features/resources/resourceAvailability', () => ({
  getLocalResourceAvailability: jest.fn(),
}))

jest.mock('~helpers/interlinearBibleSidecar', () => ({
  getInterlinearSidecarAvailability: jest.fn(),
}))

jest.mock('~helpers/strongBibleSidecar', () => ({
  getStrongBibleSidecarAvailability: jest.fn(),
}))

jest.mock('~helpers/biblesDb', () => ({
  getBibleVersionCoverage: jest.fn(),
}))

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
}))

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

import type { BibleTab, VersionCode } from '~state/tabs'
import {
  resolveBibleTabResources,
  type BibleTabResourceResolutionDependencies,
  type BibleTabResourceState,
} from '../bibleTabResourceResolution'

const createData = (selectedVersion: VersionCode): BibleTabResourceState => ({
  selectedVersion,
  strongMode: 'hidden',
  interlinearMode: 'hidden',
  selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  selectedChapter: 1,
  selectedVerse: 1,
  parallelVersions: [],
})

const createDependencies = (
  installedVersions: string[],
  installedInterlinearLocales: ('fr' | 'en')[] = [],
  installedStrongSidecars: string[] = installedVersions
): BibleTabResourceResolutionDependencies => ({
  isBibleAvailable: jest.fn(async versionId => installedVersions.includes(versionId)),
  isInterlinearIndexAvailable: jest.fn(async locale =>
    installedInterlinearLocales.includes(locale)
  ),
  isStrongSidecarAvailable: jest.fn(async versionId => installedStrongSidecars.includes(versionId)),
  getBibleCoverage: jest.fn(async () => ({
    books: [1],
    chaptersByBook: { 1: [1] },
    verseCountByBookChapter: { '1-1': 31 },
  })),
})

describe('resolveBibleTabResources', () => {
  it.each([
    ['LSGS', 'LSG'],
    ['KJVS', 'KJV'],
  ] as const)(
    'migrates %s to its canonical Bible with Strong visible',
    async (legacy, canonical) => {
      const result = await resolveBibleTabResources(
        createData(legacy),
        'fr',
        createDependencies([canonical])
      )

      expect(result).toMatchObject({
        selectedVersion: canonical,
        strongMode: 'visible',
      })
    }
  )

  it.each([
    ['INT', 'fr'],
    ['INT_EN', 'en'],
  ] as const)('migrates %s to BHG with its localized interlinear index', async (legacy, locale) => {
    const result = await resolveBibleTabResources(
      createData(legacy),
      'fr',
      createDependencies(['BHG', legacy], [locale])
    )

    expect(result).toMatchObject({
      selectedVersion: 'BHG',
      interlinearMode: 'interlinear',
      interlinearLocale: locale,
    })
  })

  it('opens BHG in simple mode when its canonical text exists without the legacy locale index', async () => {
    const result = await resolveBibleTabResources(
      createData('INT_EN'),
      'fr',
      createDependencies(['BHG', 'INT_EN'])
    )

    expect(result).toMatchObject({
      selectedVersion: 'BHG',
      interlinearMode: 'hidden',
      interlinearLocale: 'en',
    })
  })

  it('keeps an installed legacy interlinear when BHG is not installed', async () => {
    const data = createData('INT')

    await expect(
      resolveBibleTabResources(data, 'fr', createDependencies(['INT']))
    ).resolves.toEqual(data)
  })

  it('falls back to an installed language default when the selected Bible is unavailable', async () => {
    const result = await resolveBibleTabResources(
      createData('BFC'),
      'fr',
      createDependencies(['LSG'])
    )

    expect(result).toMatchObject({
      selectedVersion: 'LSG',
      strongMode: 'hidden',
      interlinearMode: undefined,
    })
  })

  it('keeps reverse interlinear mode when BHG and either STEP index are installed', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(
      resolveBibleTabResources(data, 'fr', createDependencies(['LSG', 'BHG'], ['en']))
    ).resolves.toEqual(data)
  })

  it('hides a restored reverse interlinear mode when its BHG or STEP dependency is missing', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(
      resolveBibleTabResources(data, 'fr', createDependencies(['LSG', 'BHG']))
    ).resolves.toMatchObject({
      selectedVersion: 'LSG',
      strongMode: 'hidden',
    })
  })

  it('hides a restored reverse interlinear mode when its Strong sidecar is missing', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(
      resolveBibleTabResources(data, 'fr', createDependencies(['LSG', 'BHG'], ['fr'], []))
    ).resolves.toMatchObject({
      selectedVersion: 'LSG',
      strongMode: 'hidden',
    })
  })

  it('moves an unsupported Catholic location to the first available fallback chapter', async () => {
    const data = {
      ...createData('BCC1923'),
      selectedBook: { Numero: 67, Nom: 'Tobie', Chapitres: 14 },
      selectedChapter: 14,
      selectedVerse: 15,
    } as BibleTabResourceState
    const result = await resolveBibleTabResources(data, 'fr', createDependencies(['LSG']))

    expect(result).toMatchObject({
      selectedVersion: 'LSG',
      selectedBook: { Numero: 1 },
      selectedChapter: 1,
      selectedVerse: 15,
    })
  })

  it('normalizes and removes unavailable parallel versions without duplicating BHG', async () => {
    const data = {
      ...createData('BHG'),
      parallelVersions: ['INT', 'LSGS', 'BFC'] as BibleTab['data']['parallelVersions'],
    }
    const result = await resolveBibleTabResources(
      data,
      'fr',
      createDependencies(['BHG', 'LSG'], ['fr'])
    )

    expect(result.parallelVersions).toEqual(['LSG'])
  })
})
