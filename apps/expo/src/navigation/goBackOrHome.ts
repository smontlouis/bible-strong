import type { router as expoRouter } from 'expo-router'
import { navigateWithPageTransition } from './pageTransition'

/** Direct links have no route to pop. Replace them rather than adding a return loop. */
export const goBackOrHome = (
  router: Pick<typeof expoRouter, 'canGoBack' | 'back' | 'replace'>,
  previousPath = ''
) => {
  const canGoBack = router.canGoBack()
  navigateWithPageTransition(
    canGoBack ? previousPath : '/',
    () => (canGoBack ? router.back() : router.replace('/')),
    'back'
  )
}
