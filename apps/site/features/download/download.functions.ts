import { createServerFn } from '@tanstack/react-start'
import { fetchDesktopRelease } from './desktopRelease'

/** What the download page says of the latest desktop version. */
export type DesktopReleaseSummary = {
  version: string
  publishedAt?: string
  notesUrl: string
}

/** The latest published desktop version; nothing when GitHub does not answer. */
export const loadDesktopRelease = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DesktopReleaseSummary | null> => {
    const release = await fetchDesktopRelease()
    if (!release) return null
    return {
      version: release.version,
      ...(release.publishedAt && { publishedAt: release.publishedAt }),
      notesUrl: release.notesUrl,
    }
  }
)
