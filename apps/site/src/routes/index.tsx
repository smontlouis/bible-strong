import { createFileRoute } from '@tanstack/react-router'
import { shareCardMeta } from '@/features/share/shareCardMeta'
import Home from '@/pages'
import { getLandingTheme } from '@/lib/landing-theme'
import {
  absoluteSiteUrl,
  HOME_FONT_PRELOADS,
  HOME_PATHS,
} from '@/features/resources/publicSite'
import { pageAddressLinks } from '@/features/resources/resourceHead'

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
      ...shareCardMeta({ kind: 'default', language: 'en' }),
      { property: 'og:url', content: absoluteSiteUrl(HOME_PATHS.en) },
    ],
    links: [...HOME_FONT_PRELOADS, ...pageAddressLinks(HOME_PATHS.en, HOME_PATHS)],
  }),
})

function LandingHome() {
  return <Home initialTheme={Route.useLoaderData()} />
}
