import { produce } from 'immer'
import { getSelectedVersesVersion } from '~state/bibleSelectionVersion'
import { clearVerseSelection, selectVerse, unselectVerse } from '~state/bibleTabRecipes'
import type { BibleTab, VersionCode } from '~state/tabs'
import { getVersionOnScreen } from './columns'
import type { ReaderRule, SelectIntent } from './types'
import type { ReaderSnapshot, ReaderWorld } from './world'

type SelectContext = { snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

export const decodeSelectIntent = (value: unknown): SelectIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'toggle-selected-verse':
      if (!isText(value.verseKey)) return undefined
      if (value.version !== undefined && typeof value.version !== 'string') return undefined
      return {
        kind: value.kind,
        verseKey: value.verseKey,
        ...(isText(value.version) && { version: value.version }),
      }
    case 'clear-selected-verses':
      return { kind: value.kind }
    default:
      return undefined
  }
}

/**
 * The Selected verses are personal Bible data (ADR-0030): none while the reader hides it, and
 * none in a version shown only in interlinear presentations.
 */
export const getSelectRefusal = (
  intent: SelectIntent,
  { snapshot }: Pick<SelectContext, 'snapshot'>
): ReaderRule | undefined => {
  if (snapshot.hidesPersonalData) return 'personal-data'
  if (
    intent.kind === 'toggle-selected-verse' &&
    intent.version &&
    snapshot.interlinearReadingVersions.includes(intent.version)
  ) {
    return 'interlinear-column'
  }
  return undefined
}

/** A verse selected in the version of the selection is unselected; any other is selected. */
const toggleSelectedVerse = (data: BibleTab['data'], verseKey: string, version: VersionCode) => {
  if (data.selectedVerses[verseKey] && version === getSelectedVersesVersion(data)) {
    unselectVerse(data, verseKey)
  } else {
    selectVerse(data, verseKey, version)
  }
}

export const applySelectIntent = (intent: SelectIntent, { snapshot, world }: SelectContext) => {
  const { store } = world
  const { tabAtom } = snapshot
  switch (intent.kind) {
    case 'toggle-selected-verse': {
      if (world.platform === 'ios') world.haptic('selection')
      store.set(
        tabAtom,
        produce(draft => {
          const version = getVersionOnScreen(snapshot, draft.data.selectedVersion, intent.version)
          toggleSelectedVerse(draft.data, intent.verseKey, version)
        })
      )
      return
    }
    case 'clear-selected-verses':
      store.set(
        tabAtom,
        produce(draft => {
          clearVerseSelection(draft.data)
        })
      )
      return
  }
}
