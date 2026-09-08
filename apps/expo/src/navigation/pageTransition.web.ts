import { store } from 'expo-router/build/global-state/router-store'

// Opening and closing form-sheet routes retain their own panel animation.
const panelPaths = new Set([
  'bible-view',
  'concordance',
  'concordance-by-book',
  'dictionnary-detail',
  'nave-detail',
  'note',
  'link',
  'edit-study',
  'entity-relations',
  'tag',
  'event',
  'pericope',
  'passage-media-player',
  'passage-resources',
  'strong',
  'commentary-chapter',
  'commentary-entry',
  'timeline-search',
])
const isPanel = (path: string) =>
  /\/\((explore|commentary|timeline-search)\)/.test(path) ||
  panelPaths.has(path.split('?')[0].split('/').filter(Boolean)[0] ?? '')

let finish: (() => void) | undefined
let active: ReturnType<Document['startViewTransition']> | undefined

export const finishPageTransition = () => finish?.()

export function navigateWithPageTransition(
  pathname: string,
  navigate: () => void,
  direction: 'forward' | 'back' = 'forward'
) {
  const fromPanel = isPanel(store.getRouteInfo().pathname)
  const toPanel = isPanel(pathname)
  if (
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    fromPanel !== toPanel
  ) {
    navigate()
    return
  }
  active?.skipTransition()
  finish?.()
  const panelTransition = fromPanel && toPanel
  const surface = panelTransition
    ? Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="workspace-route-panel"]')
      ).findLast(element => element.getBoundingClientRect().width > 0)
    : document.querySelector<HTMLElement>('[data-testid="workspace-main-surface"]')
  if (!surface) {
    navigate()
    return
  }
  document.documentElement.dataset.pageTransitionDirection = direction
  if (panelTransition) document.documentElement.dataset.panelViewTransition = 'true'
  else surface.style.viewTransitionName = 'workspace-page'
  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(done, 1500)
        function done() {
          window.clearTimeout(timeout)
          if (finish === done) finish = undefined
          resolve()
        }
        finish = done
        try {
          navigate()
        } catch (error) {
          done()
          reject(error)
        }
      })
  )
  active = transition
  void transition.finished
    .catch(() => {})
    .finally(() => {
      if (active === transition) {
        delete document.documentElement.dataset.panelViewTransition
        delete document.documentElement.dataset.pageTransitionDirection
        active = undefined
        surface.style.removeProperty('view-transition-name')
      }
    })
}
