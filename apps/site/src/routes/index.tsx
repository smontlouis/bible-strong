import { createFileRoute } from '@tanstack/react-router'
import { shareCardMeta } from '@/features/share/shareCardMeta'
import Home from '@/pages'
import { getLandingTheme } from '@/lib/landing-theme'
import { absoluteSiteUrl } from '@/features/resources/publicSite'

// The weights the first screen is set in: they are asked for with the page, not after its
// styles, so the text is rarely painted in another font first.
const FIRST_SCREEN_FONTS = ['Regular', 'Semi Bold', 'Bold'].map(weight => ({
  rel: 'preload',
  as: 'font',
  type: 'font/otf',
  href: `/fonts/UpType%20-%20Pulp%20Display%20${weight.replace(' ', '%20')}.otf`,
  crossOrigin: 'anonymous' as const,
}))
export const Route = createFileRoute('/')({
  loader: () => getLandingTheme(),
  component: LandingHome,
  head: () => ({
    meta: [
      { title: 'Bible Strong - One verse, a complete study' },
      {
        name: 'description',
        content:
          'Read the Bible, explore original Hebrew and Greek words, connect notes, and keep your study available offline.',
      },
      { property: 'og:title', content: 'Bible Strong - One verse, a complete study' },
      { property: 'og:description', content: 'Bible reading and study tools that keep every discovery connected.' },
      ...shareCardMeta('/', { kind: 'default', language: 'en' }),
      { property: 'og:url', content: absoluteSiteUrl('/') },
    ],
    links: [...FIRST_SCREEN_FONTS, { rel: 'canonical', href: absoluteSiteUrl('/') }],
  }),
})

function LandingHome() {
  return <Home initialTheme={Route.useLoaderData()} />
}
