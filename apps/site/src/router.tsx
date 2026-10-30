import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { fadesToNextPage } from '@/features/resources/pageNavigation'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // A page reached with other parameters starts anew, as a loaded document does.
    defaultRemountDeps: ({ params, loaderDeps }) => ({ params, loaderDeps }),
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) =>
        fadesToNextPage(fromLocation?.pathname, toLocation.pathname) ? ['page'] : false,
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof getRouter> }
}
