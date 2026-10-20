import { produce } from 'immer'

import {
  getBibleColumnTextModes,
  getParallelColumnTextModes,
  materializeParallelTextModes,
  resetParallelColumnTextModes,
  setBibleColumnTextModes,
  type BibleColumnTextModesData,
} from '../bibleColumnTextModes'
import { getColumnTextModeControls } from '~features/bible/columnTextModeControls'

const legacyTab = (
  overrides: Partial<BibleColumnTextModesData> = {}
): BibleColumnTextModesData => ({
  selectedVersion: 'LSG',
  strongMode: 'visible',
  interlinearMode: undefined,
  interlinearLocale: 'en',
  parallelVersions: ['KJV', 'BDS', 'BHG'],
  ...overrides,
})

describe('getParallelColumnTextModes', () => {
  it('shows a tab written before per-column modes as its columns displayed it', () => {
    expect(getParallelColumnTextModes(legacyTab())).toEqual([
      { version: 'KJV', strongMode: 'visible', interlinearLocale: 'en' },
      { version: 'BDS', strongMode: 'hidden', interlinearLocale: 'en' },
      { version: 'BHG', strongMode: 'hidden', interlinearMode: 'strong', interlinearLocale: 'en' },
    ])
  })

  it.each([
    ['reverse-interlinear', undefined, 'interlinear'],
    ['transliteration', undefined, 'transliteration'],
    ['hidden', 'transliteration', 'transliteration'],
    ['hidden', undefined, 'hidden'],
  ] as const)(
    'derives the BHG column of a legacy tab from Strong %s and interlinear %s',
    (strongMode, interlinearMode, expected) => {
      const [bhg] = getParallelColumnTextModes(
        legacyTab({ strongMode, interlinearMode, parallelVersions: ['BHG'] })
      )
      expect(bhg.interlinearMode).toBe(expected)
    }
  )

  it('keeps the modes of each column, even for the same version twice', () => {
    const data = legacyTab({
      parallelVersions: ['LSG', 'LSG'],
      parallelTextModes: [
        { version: 'LSG', strongMode: 'hidden' },
        { version: 'LSG', strongMode: 'reverse-interlinear' },
      ],
    })

    expect(getParallelColumnTextModes(data).map(modes => modes.strongMode)).toEqual([
      'hidden',
      'reverse-interlinear',
    ])
  })

  it('starts a column whose version changed elsewhere without any mode', () => {
    const data = legacyTab({
      parallelVersions: ['KJV', 'BHG'],
      parallelTextModes: [{ version: 'BSB', strongMode: 'visible' }],
    })

    expect(getParallelColumnTextModes(data)).toEqual([
      { version: 'KJV', strongMode: 'hidden', interlinearMode: undefined },
      { version: 'BHG', strongMode: 'hidden', interlinearMode: 'hidden' },
    ])
  })
})

describe('materializeParallelTextModes', () => {
  it('writes the derived modes down once', () => {
    const data = legacyTab()
    const materialized = materializeParallelTextModes(data)

    expect(materialized.parallelTextModes).toEqual(getParallelColumnTextModes(data))
    expect(materializeParallelTextModes(materialized)).toBe(materialized)
  })

  it('leaves a tab without parallel reading untouched', () => {
    const data = legacyTab({ parallelVersions: [] })
    expect(materializeParallelTextModes(data)).toBe(data)
  })

  it('leaves data without parallel versions untouched', () => {
    const data = { selectedVersion: 'LSG' } as unknown as BibleColumnTextModesData
    expect(materializeParallelTextModes(data)).toBe(data)
  })
})

describe('setBibleColumnTextModes', () => {
  it('changes the main version without changing what the parallel columns show', () => {
    const data = legacyTab()
    const before = getParallelColumnTextModes(data)

    const next = produce(data, draft => {
      setBibleColumnTextModes(draft, 0, { strongMode: 'hidden' })
    })

    expect(next.strongMode).toBe('hidden')
    expect(getParallelColumnTextModes(next)).toEqual(before)
  })

  it('changes one parallel column only', () => {
    const data = legacyTab({ strongMode: 'hidden', parallelVersions: ['LSG', 'LSG'] })

    const next = produce(data, draft => {
      setBibleColumnTextModes(draft, 2, { strongMode: 'visible' })
    })

    expect(next.strongMode).toBe('hidden')
    expect(getParallelColumnTextModes(next).map(modes => modes.strongMode)).toEqual([
      'hidden',
      'visible',
    ])
    expect(getBibleColumnTextModes(next, 2)?.strongMode).toBe('visible')
  })
})

describe('resetParallelColumnTextModes', () => {
  it('starts a column taking a new version without any mode', () => {
    const data = legacyTab()

    const next = produce(data, draft => {
      resetParallelColumnTextModes(draft, 0, 'BHG')
      draft.parallelVersions[0] = 'BHG'
    })

    expect(getParallelColumnTextModes(next)).toEqual([
      { version: 'BHG', strongMode: 'hidden', interlinearMode: 'hidden' },
      { version: 'BDS', strongMode: 'hidden', interlinearLocale: 'en' },
      { version: 'BHG', strongMode: 'hidden', interlinearMode: 'strong', interlinearLocale: 'en' },
    ])
  })
})

describe('getColumnTextModeControls', () => {
  it('gives each column the buttons its version supports', () => {
    const controls = getColumnTextModeControls({
      ...legacyTab({
        selectedVersion: 'BDS',
        strongMode: 'hidden',
        parallelVersions: ['LSG', 'BHG'],
      }),
      parallelTextModes: [
        { version: 'LSG', strongMode: 'visible' },
        { version: 'BHG', strongMode: 'hidden', interlinearMode: 'hidden' },
      ],
    })

    expect(controls).toEqual([{}, { strong: { active: true } }, { interlinear: { active: false } }])
  })
})
