import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { I18nProvider, useCurrentLocale } from '@/locales'
import appCss from '../styles.css?url'

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Bible Strong App - Lexique Hébreu et Grec' },
      { name: 'description', content: "Le projet Bible Strong met à disposition des outils efficaces d'étude de la Bible pour développer et affermir une foi réfléchie en Dieu par sa Parole." },
      { property: 'og:image', content: '/image-fb.jpg' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/images/icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Literata&display=swap' },
    ],
    scripts: [
      { src: 'https://www.googletagmanager.com/gtag/js?id=UA-109677220-2', async: true },
      { children: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','UA-109677220-2');" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => <main className="grid min-h-screen place-items-center p-6"><p>Page introuvable.</p></main>,
  errorComponent: () => <main className="grid min-h-screen place-items-center p-6"><p>Une erreur est survenue.</p></main>,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()
  const locale = useCurrentLocale()
  return (
    <html lang={locale}>
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={queryClient}><I18nProvider>{children}</I18nProvider></QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
