import { createContext, useContext } from 'react'
import { useAtomValue } from 'jotai/react'
import { isFullScreenBibleAtom } from 'src/state/app'

/**
 * Full-screen reading belongs to the Bible tab. A reader opened in a sheet never enters it,
 * so its footer must not hide when the tab behind does.
 */
const FooterInSheetContext = createContext(false)

export const FooterInSheetProvider = FooterInSheetContext.Provider

export const useFooterFullScreen = (): boolean => {
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  return !useContext(FooterInSheetContext) && isFullScreenBible
}
