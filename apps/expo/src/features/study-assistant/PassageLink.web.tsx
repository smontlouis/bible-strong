import type { ReactNode } from 'react'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useReferencePreview } from '~features/bibleReferencePreview/state'
export default function PassageLink({
  osis,
  children,
  version,
}: {
  osis: string
  children: ReactNode
  version?: string
}) {
  const navigate = usePushRouteOnce(),
    preview = useReferencePreview()
  const route = getBibleViewRouteForStrongOsisReference(osis)
  if (!route) return <span>{children}</span>
  const open = () =>
    navigate({ ...route, params: { ...route.params, ...(version ? { version } : {}) } })
  return (
    <button
      type="button"
      className="bs-assistant-passage-link"
      onClick={() => {
        if (!preview({ href: `bible://${osis}`, type: 'bible' }, open, version)) open()
      }}
    >
      {children}
    </button>
  )
}
