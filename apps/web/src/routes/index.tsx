import { createFileRoute } from '@tanstack/react-router'
import Home from '@/pages'
export const Route = createFileRoute('/')({
  component: Home,
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
