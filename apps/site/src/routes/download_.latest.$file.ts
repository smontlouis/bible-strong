import { createFileRoute } from '@tanstack/react-router'
import {
  DESKTOP_RELEASES_URL,
  fetchDesktopRelease,
  isDesktopFile,
} from '@/features/download/desktopRelease'

// `/download/latest/<file>` leads to the installer of the latest published desktop version:
// `mac`, `windows`, `linux-appimage` or `linux-deb`. The pages link to it, never to a version,
// so they never need to change when one is published.
export const Route = createFileRoute('/download_/latest/$file')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isDesktopFile(params.file)) return new Response('Not found', { status: 404 })
        const location = (await fetchDesktopRelease())?.files[params.file]
        // Without the manifest, the reader is sent to the list of versions, and the answer is
        // not kept, so that the next reader asks GitHub again.
        if (!location) {
          return new Response(null, {
            status: 302,
            headers: { location: DESKTOP_RELEASES_URL, 'cache-control': 'private, no-store' },
          })
        }
        return new Response(null, {
          status: 302,
          headers: {
            location,
            // Kept five minutes, as the manifest is: a new version reaches readers within ten.
            'cache-control': 'public, max-age=0, s-maxage=300',
            'x-robots-tag': 'noindex',
          },
        })
      },
    },
  },
})
