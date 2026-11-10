import { buildResourceHead } from '../resources/resourceHead'
import type { ResourceLanguage } from '../resources/publicSite'
import type { DesktopReleaseSummary } from './download.functions'
import { DOWNLOAD_PATHS, downloadMessages } from './downloadMessages'

/** The head of the download page in a language. */
export const downloadPageHead = (language: ResourceLanguage) => {
  const t = downloadMessages(language)
  return buildResourceHead({
    title: t.meta.title,
    description: t.meta.description,
    path: DOWNLOAD_PATHS[language],
    language,
    alternates: DOWNLOAD_PATHS,
    ogType: 'website',
    shareCard: { kind: 'default', language },
  })
}

/**
 * How long the CDN keeps the download page. Its links lead to the latest installers whatever
 * the page says; only the version it names follows a publication, within ten minutes. Without
 * the version, it is asked again within a minute.
 */
export const downloadPageHeaders = (
  loaderData: { release: DesktopReleaseSummary | null } | undefined
) => ({
  'cache-control': loaderData?.release
    ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600'
    : 'public, max-age=0, s-maxage=60',
})
