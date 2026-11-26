import { useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { appLogger } from '~helpers/agentObservability'
import formatVerseContent from '~helpers/formatVerseContent'
import { historyBaseAtom } from '~state/app'
import { activeGroupAtom } from '~state/tabs'

import { invoke } from './bridge'
import {
  buildDesktopMenuState,
  type DesktopMenuState,
  type RecentPassage,
} from './desktopMenuState'

/** File › Open Recent lists only the passages read after this time; History keeps them all. */
export const desktopRecentsClearedAtAtom = atomWithAsyncStorage<number>(
  'desktopRecentPassagesClearedAt',
  0
)

// The workspace changes in bursts (a tab opens, then gets its title): one rebuild per burst.
const REBUILD_DELAY_MS = 150

// Rebuilds go to the shell in order, so an older menu never replaces a newer one.
let queue: Promise<unknown> = Promise.resolve()
const sendMenu = (state: DesktopMenuState) => {
  queue = queue
    .then(() => invoke('menu_update', { state }))
    .catch(error =>
      appLogger.warn('startup', 'desktop.menu_update_failed', { error: String(error) })
    )
}

/** « Jean 3 · LSG », as the History names a reading. */
const passageLabel = ({ version, book, chapter }: RecentPassage) => {
  const { title } = formatVerseContent([{ Livre: book, Chapitre: chapter, Verset: 1 }])
  return `${title.replace(/:1$/u, '')} · ${version}`
}

/**
 * Keeps the native menu in step with the workspace: its language, the tabs of the active group in
 * the Window menu and the last passages read in File › Open Recent. `refresh` sends the menu again
 * even when nothing changed: a checked item flips its own mark when it is chosen.
 */
export const useDesktopMenu = () => {
  const { t, i18n } = useTranslation()
  const group = useAtomValue(activeGroupAtom)
  const history = useAtomValue(historyBaseAtom)
  const clearedAt = useAtomValue(desktopRecentsClearedAtAtom)
  const [revision, setRevision] = useState(0)

  const serialized = useMemo(
    () =>
      JSON.stringify(
        buildDesktopMenuState({
          language: i18n.language,
          group,
          history,
          clearedAt,
          untitledTab: t('tabs.new'),
          passageLabel,
        })
      ),
    [clearedAt, group, history, i18n.language, t]
  )

  useEffect(() => {
    const timer = setTimeout(
      () => sendMenu(JSON.parse(serialized) as DesktopMenuState),
      REBUILD_DELAY_MS
    )
    return () => clearTimeout(timer)
  }, [serialized, revision])

  const refresh = useCallback(() => setRevision(value => value + 1), [])
  return { refresh }
}
