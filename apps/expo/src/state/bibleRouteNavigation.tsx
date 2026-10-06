import { createContext, useContext, type ReactNode } from 'react'

import type { Book } from '~assets/bible_versions/books-desc'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import type { StrongMode } from '~helpers/strongBiblePublications'

export type BibleRouteNavigationAdapter = {
  openChapter: (book: Book, chapter: number) => void
  replaceWithChapter: (book: Book, chapter: number) => void
  changeVersion: (version: string) => void
  changeStrongMode: (mode: StrongMode) => void
  /**
   * Moves to the route of an interlinear display when one exists. Returns false when the
   * display has no route of its own, so the caller keeps it in the tab.
   */
  changeInterlinearMode?: (mode: InterlinearMode, locale?: ResourceLanguage) => boolean
}

const BibleRouteNavigationContext = createContext<BibleRouteNavigationAdapter | undefined>(
  undefined
)

export const BibleRouteNavigationProvider = ({
  adapter,
  children,
}: {
  adapter?: BibleRouteNavigationAdapter
  children: ReactNode
}) =>
  adapter ? (
    <BibleRouteNavigationContext.Provider value={adapter}>
      {children}
    </BibleRouteNavigationContext.Provider>
  ) : (
    children
  )

export const useBibleRouteNavigation = (): BibleRouteNavigationAdapter | undefined =>
  useContext(BibleRouteNavigationContext)
