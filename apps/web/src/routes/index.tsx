import { createFileRoute } from '@tanstack/react-router'
import Home from '@/pages'
import { getLandingTheme } from '@/lib/landing-theme'
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
      { property: 'og:image', content: '/image-fb.jpg' },
    ],
  }),
})

function LandingHome() {
  return <Home initialTheme={Route.useLoaderData()} />
}
