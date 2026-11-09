import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationProgress, PageFailure, usePublishedLinks } from '@/components/SiteNavigation'
import { shareCardMeta } from '@/features/share/shareCardMeta'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import NotFoundPage from '@/features/resources/NotFoundPage'
import { useCurrentLocale } from '@/locales'
import { SITE_ORIGIN } from '@/features/resources/publicSite'
import appCss from '../styles.css?url'

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: ({ matches }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Safari's banner for the iOS app: its Open button hands this page to the app (ADR-0082).
      {
        name: 'apple-itunes-app',
        content: `app-id=1454738221, app-argument=${SITE_ORIGIN}${matches.at(-1)?.pathname ?? '/'}`,
      },
      { title: 'Bible Strong App - Lexique Hébreu et Grec' },
      { name: 'description', content: "Le projet Bible Strong met à disposition des outils efficaces d'étude de la Bible pour développer et affermir une foi réfléchie en Dieu par sa Parole." },
      ...shareCardMeta(),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // The mark as it is drawn in a header or a tab; the full-size one is for the manifest.
      { rel: 'icon', type: 'image/png', sizes: '144x144', href: '/images/icon-144.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: PageFailure,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()
  const locale = useCurrentLocale()
  usePublishedLinks()
  return (
    <html lang={locale}>
      <head><HeadContent /></head>
      <body>
        <NavigationProgress />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
