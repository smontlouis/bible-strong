/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

import type { BibleTab, VersionCode } from '~state/tabs'
import { resolveBibleTabResources, type BibleTabResourceState } from '../bibleTabResourceResolution'

const createData = (selectedVersion: VersionCode): BibleTabResourceState => ({
  selectedVersion,
  strongMode: 'hidden',
  interlinearMode: 'hidden',
  selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  selectedChapter: 1,
  selectedVerse: 1,
  parallelVersions: [],
})

describe('resolveBibleTabResources', () => {
  it('preserves a selected Bible when no offline copy is installed', async () => {
    const result = await resolveBibleTabResources(createData('BFC'))

    expect(result).toEqual(createData('BFC'))
  })

  it('preserves the requested Strong mode for a provider-defined Bible capability', async () => {
    const data = { ...createData('BFC'), strongMode: 'visible' as const }

    await expect(resolveBibleTabResources(data)).resolves.toEqual(data)
  })

  it('keeps reverse interlinear mode when BHG and either STEP index are installed', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(resolveBibleTabResources(data)).resolves.toEqual(data)
  })

  it('preserves reverse interlinear mode when its offline BHG or STEP dependency is missing', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(resolveBibleTabResources(data)).resolves.toEqual(data)
  })

  it('preserves reverse interlinear mode when its offline Strong sidecar is missing', async () => {
    const data = {
      ...createData('LSG'),
      strongMode: 'reverse-interlinear' as const,
    }

    await expect(resolveBibleTabResources(data)).resolves.toEqual(data)
  })

  it('preserves a selected Catholic location for resource coverage resolution', async () => {
    const data = {
      ...createData('BCC1923'),
      selectedBook: { Numero: 67, Nom: 'Tobie', Chapitres: 14 },
      selectedChapter: 14,
      selectedVerse: 15,
    } as BibleTabResourceState
    const result = await resolveBibleTabResources(data)

    expect(result).toEqual(data)
  })

  it('preserves parallel versions without offline copies', async () => {
    const data = {
      ...createData('BHG'),
      parallelVersions: ['BFC'] as BibleTab['data']['parallelVersions'],
    }
    const result = await resolveBibleTabResources(data)

    expect(result.parallelVersions).toEqual(['BFC'])
  })
})
