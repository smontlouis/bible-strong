import { createFileRoute } from '@tanstack/react-router'
import { DownloadPage } from '@/features/download/DownloadPage'
import { loadDesktopRelease } from '@/features/download/download.functions'
import { downloadPageHead, downloadPageHeaders } from '@/features/download/downloadRoute'

// `/fr/download` — every way to get Bible Strong, in French.
export const Route = createFileRoute('/fr/download')({
  loader: async () => ({ release: await loadDesktopRelease() }),
  head: () => downloadPageHead('fr'),
  headers: ({ loaderData }) => downloadPageHeaders(loaderData),
  component: DownloadRoute,
})

function DownloadRoute() {
  return <DownloadPage release={Route.useLoaderData().release} />
}
