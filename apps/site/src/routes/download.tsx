import { createFileRoute } from '@tanstack/react-router'
import { DownloadPage } from '@/features/download/DownloadPage'
import { loadDesktopRelease } from '@/features/download/download.functions'
import { downloadPageHead, downloadPageHeaders } from '@/features/download/downloadRoute'

// `/download` — every way to get Bible Strong; `/download/latest/<file>` leads to the installers.
export const Route = createFileRoute('/download')({
  loader: async () => ({ release: await loadDesktopRelease() }),
  head: () => downloadPageHead('en'),
  headers: ({ loaderData }) => downloadPageHeaders(loaderData),
  component: DownloadRoute,
})

function DownloadRoute() {
  return <DownloadPage release={Route.useLoaderData().release} />
}
