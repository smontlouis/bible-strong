import { produce } from 'immer'
import { selectBibleTabVersion } from '~helpers/bibleTabVersionSelection'
import { isFullScreenBibleAtom } from '~state/app'
import {
  getAdjacentChapter,
  getBibleContextDisplayMode,
  openAdjacentChapter,
  setParallelColumnVersion,
} from '~state/bibleTabRecipes'
import type { VersionCode } from '~state/tabs'
import { canGoToNextPlanChapter, canGoToPreviousPlanChapter } from '../planPassage'
import type { ReaderRule, ReadingIntent } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

type ReadingContext = { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isColumn = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

export const decodeReadingIntent = (value: unknown): ReadingIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'next-chapter':
    case 'previous-chapter':
    case 'hide-controls':
    case 'show-controls':
    case 'plan-day-step':
      return { kind: value.kind }
    case 'choose-column-version':
      return isColumn(value.column) ? { kind: value.kind, column: value.column } : undefined
    case 'open-column-text-mode':
      return (value.mode === 'strong' || value.mode === 'interlinear') && isColumn(value.column)
        ? { kind: value.kind, mode: value.mode, column: value.column }
        : undefined
    default:
      return undefined
  }
}

const getChapterTarget = (
  intent: Extract<ReadingIntent, { kind: 'next-chapter' | 'previous-chapter' }>,
  { snapshot, world }: Omit<ReadingContext, 'reader'>
) => {
  const data = world.store.get(snapshot.tabAtom).data
  return getAdjacentChapter(
    data,
    intent.kind === 'next-chapter' ? 'next' : 'previous',
    snapshot.coverage
  )
}

/** The rule refusing a reading intent, checked before any effect. */
export const getReadingRefusal = (
  intent: ReadingIntent,
  { snapshot, world }: Omit<ReadingContext, 'reader'>
): ReaderRule | undefined => {
  switch (intent.kind) {
    case 'next-chapter':
    case 'previous-chapter': {
      const data = world.store.get(snapshot.tabAtom).data
      if (getBibleContextDisplayMode(data) === 'focused') return 'focus'
      if (snapshot.annotationMode) return 'annotation-mode'
      const location = { book: data.selectedBook.Numero, chapter: data.selectedChapter }
      const canGoToPlanChapter =
        intent.kind === 'next-chapter' ? canGoToNextPlanChapter : canGoToPreviousPlanChapter
      if (!canGoToPlanChapter(data.planPassage, location)) return 'plan-passage'
      if (!getChapterTarget(intent, { snapshot, world })) return 'no-chapter'
      return undefined
    }
    case 'hide-controls':
      if (snapshot.isFormSheet) return 'form-sheet'
      if (snapshot.keepControlsVisible) return 'controls-kept-visible'
      return undefined
    case 'show-controls':
      return snapshot.isFormSheet ? 'form-sheet' : undefined
    case 'plan-day-step':
      return snapshot.hasPlanDayStep ? undefined : 'no-plan-day-step'
    case 'choose-column-version':
    case 'open-column-text-mode':
      return undefined
  }
}

export const applyReadingIntent = (
  intent: ReadingIntent,
  { reader, snapshot, world }: ReadingContext
) => {
  const { store } = world
  const { tabAtom } = snapshot
  switch (intent.kind) {
    case 'next-chapter':
    case 'previous-chapter': {
      const target = getChapterTarget(intent, { snapshot, world })
      if (!target) return
      if (world.routes) {
        world.routes.openChapter(target.book, target.chapter)
        return
      }
      store.set(
        tabAtom,
        produce(draft => {
          openAdjacentChapter(draft.data, target)
        })
      )
      return
    }
    case 'hide-controls':
      store.set(isFullScreenBibleAtom, true)
      return
    case 'show-controls':
      store.set(isFullScreenBibleAtom, false)
      return
    case 'plan-day-step':
      reader.surface({ kind: 'plan-day-step' })
      return
    case 'choose-column-version':
      world.openVersionSelector({
        actions: {
          setSelectedVersion: (version: VersionCode) =>
            store.set(
              tabAtom,
              produce(draft => {
                draft.data = selectBibleTabVersion(draft.data, version)
              })
            ),
          setParallelVersion: (version: VersionCode, index: number) =>
            store.set(
              tabAtom,
              produce(draft => {
                setParallelColumnVersion(draft.data, index, version)
              })
            ),
        },
        data: store.get(tabAtom).data,
        parallelVersionIndex: intent.column === 0 ? undefined : intent.column - 1,
      })
      return
    case 'open-column-text-mode':
      reader.surface({ kind: 'column-text-mode', mode: intent.mode, column: intent.column })
      return
  }
}
