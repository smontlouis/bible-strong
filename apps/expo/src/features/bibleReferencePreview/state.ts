import { Platform } from 'react-native'
import { createContext, useContext } from 'react'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import { parseResourcePreviewLink, type PreviewSource } from './resourceTarget'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { activeBibleTabVersionAtom } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import type { HTMLViewLinkPayload } from '~common/htmlContentTypes'
import { parseReferencePreviewLink } from './referenceTarget'
import { previewHistoryAtom, type PreviewRequest } from './previewHistory'

export {
  previewHistoryAtom,
  type PreviewRequest,
  type ReferencePreviewRequest,
} from './previewHistory'
export const PreviewNestedContext = createContext(false)

export function useReferencePreview() {
  const setHistory = useSetAtom(previewHistoryAtom)
  const nested = useContext(PreviewNestedContext)
  const languages = useResourcesLanguageValue()
  const readerVersion = useAtomValue(activeBibleTabVersionAtom)
  const defaultVersion = useDefaultBibleVersion()
  return (
    payload: Pick<HTMLViewLinkPayload, 'href' | 'type'>,
    open: () => void,
    version?: string,
    source?: PreviewSource
  ) => {
    if (Platform.OS !== 'web') return false
    const bible = parseReferencePreviewLink(payload)
    const resource = bible ? undefined : parseResourcePreviewLink(payload, source, languages.STRONG)
    const request: PreviewRequest | undefined = bible
      ? {
          ...bible,
          kind: 'bible',
          version: bible.version || version || readerVersion || defaultVersion,
          open,
        }
      : resource
        ? { ...resource, open }
        : undefined
    if (!request) return false
    setHistory(history => (nested ? [...history, request] : [request]))
    return true
  }
}
