import { createFileRoute } from '@tanstack/react-router'
import Home from '@/pages'
import { getLandingTheme } from '@/lib/landing-theme'
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
      { property: 'og:image', content: '/image-fb.jpg' },
    ],
  }),
})

function LandingHome() {
  return <Home initialTheme={Route.useLoaderData()} />
}
