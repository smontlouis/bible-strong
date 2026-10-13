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
export const Route = createFileRoute('/fr/')({
  loader: () => getLandingTheme(),
  component: LandingHome,
  head: () => ({
    meta: [
      { title: 'Bible Strong - Un verset, une étude entière' },
      {
        name: 'description',
        content:
          'Lisez la Bible, explorez les mots hébreux et grecs, reliez vos notes et gardez votre étude disponible hors ligne.',
      },
      { property: 'og:title', content: 'Bible Strong - Un verset, une étude entière' },
      { property: 'og:description', content: 'Des outils de lecture et d’étude biblique qui gardent chaque découverte reliée.' },
      ...shareCardMeta({ kind: 'default', language: 'fr' }),
      { property: 'og:url', content: absoluteSiteUrl(HOME_PATHS.fr) },
    ],
    links: [...HOME_FONT_PRELOADS, ...pageAddressLinks(HOME_PATHS.fr, HOME_PATHS)],
  }),
})

function LandingHome() {
  return <Home initialTheme={Route.useLoaderData()} />
}
