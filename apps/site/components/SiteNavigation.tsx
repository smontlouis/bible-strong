import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { siteAddress } from '@/features/resources/pageNavigation'

/** A thin line at the top of the window while the next page loads; a quick move never shows it. */
export function NavigationProgress() {
  const loading = useRouterState({ select: state => state.status === 'pending' })
  return loading ? <div className="site-progress" aria-hidden="true" /> : null
}

/**
 * The links written in a published text are plain HTML, out of reach of a `Link`: their clicks
 * are given to the router here. A link of the page's own, or one the reader opens elsewhere, is
 * left alone.
 */
export function usePublishedLinks() {
  const router = useRouter()
  useEffect(() => {
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element).closest?.('a')
      const href = link?.getAttribute('href')
      if (!link || !href || (link.target && link.target !== '_self')) return
      if (!siteAddress(href)) return
      event.preventDefault()
      void router.navigate({ href })
    }
    document.addEventListener('click', follow)
    return () => document.removeEventListener('click', follow)
  }, [router])
}

const RETRIED_PAGE = 'site-retried-page'

/**
 * What a page that fails shows. A page reached inside the document can fail where a loaded one
 * does not: a tab older than the last deployment asks for scripts that are gone. The page is
 * then loaded whole, once.
 */
export function PageFailure() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(RETRIED_PAGE) === location.href) return
      sessionStorage.setItem(RETRIED_PAGE, location.href)
    } catch {
      return
    }
    location.reload()
  }, [])
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <p>Une erreur est survenue.</p>
    </main>
  )
}
