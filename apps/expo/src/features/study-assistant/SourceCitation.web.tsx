import type { ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import type { StudySource } from '@bible-strong/ai-contract/contract'
import { sourceRoute, sourceDisplayTitle } from './sourceNavigation'
export default function SourceCitation({
  source,
  children,
}: {
  source: StudySource
  children: ReactNode
}) {
  const setPreview = useSetAtom(previewHistoryAtom)
  const navigate = usePushRouteOnce()
  const title = sourceDisplayTitle(source)
  return (
    <button
      type="button"
      className="bs-assistant-passage-link"
      onClick={() =>
        setPreview([
          {
            kind: 'excerpt',
            title,
            text: source.excerpt,
            open: () => navigate(sourceRoute(source)),
          },
        ])
      }
    >
      {children}
    </button>
  )
}
