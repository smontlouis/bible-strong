import { lazy, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { installButtonHaptics } from './haptics'
import { UniverseHost } from './UniverseHost'
import { canonicalPath, universeAt } from './universes'
import './style.css'

const GuestbookAdmin = lazy(() => import('./GuestbookAdmin'))
const admin = ['/admin', '/admin/', '/admin-guestbook'].includes(location.pathname)

// Relative asset URLs resolve against the page: keep world addresses without a trailing slash.
if (!admin && canonicalPath(location.pathname) !== location.pathname)
  history.replaceState(null, '', `${canonicalPath(location.pathname)}${location.search}${location.hash}`)

const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (!import.meta.hot?.data.haptics) installButtonHaptics()
if (import.meta.hot) import.meta.hot.data.haptics = true
if (import.meta.hot) import.meta.hot.data.root = root
root.render(
  admin ? (
    <Suspense fallback={<p>…</p>}>
      <GuestbookAdmin />
    </Suspense>
  ) : (
    <UniverseHost initial={universeAt(location.pathname)} />
  )
)
