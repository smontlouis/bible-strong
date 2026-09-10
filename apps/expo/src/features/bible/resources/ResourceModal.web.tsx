import { goBackOrHome } from '~navigation/goBackOrHome'
import { useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai/react'
import { usePathname, useRouter, useGlobalSearchParams } from 'expo-router'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import generateUUID from '~helpers/generateUUID'
import type { ResourceModalProps } from './ResourceModalContent'
import { resourceSidebarSources } from './resourceSidebarRegistry'

export default function ResourceModal(props: ResourceModalProps) {
  const [sourceId] = useState(generateUUID)
  const latest = useRef(props)
  const [request, setRequest] = useState(0)
  const handled = useRef(0)
  const bible = useAtomValue(props.bibleAtom)
  const push = usePushRouteOnce()
  const router = useRouter()
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  useLayoutEffect(() => {
    latest.current = props
  })
  useLayoutEffect(() => {
    resourceSidebarSources.set(sourceId, latest)
    return () => {
      resourceSidebarSources.delete(sourceId)
    }
  }, [sourceId])
  useLayoutEffect(() => {
    if (!request || handled.current === request) return
    handled.current = request
    const selectedVerses = props.selectedVerses ?? bible.data.selectedVerses
    if (!Object.keys(selectedVerses).length) return
    const next = {
      sourceId,
      resourceType: props.resourceType ?? 'strong',
      version: props.selectedVersion ?? bible.data.selectedVersion,
      selectedVerses: JSON.stringify(selectedVerses),
    }
    if (pathname === '/passage-resources' && params.sourceId === sourceId) router.setParams(next)
    else push({ pathname: '/passage-resources', params: next })
  }, [request, props, bible.data, pathname, params.sourceId, sourceId, router, push])
  useImperativeHandle(props.resourceModalRef, () => {
    const present = () => setRequest(value => value + 1)
    const dismiss = () => {
      if (pathname === '/passage-resources' && params.sourceId === sourceId) goBackOrHome(router)
    }
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss,
      close: dismiss,
      forceClose: dismiss,
    }
  })
  return null
}
