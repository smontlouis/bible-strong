import { OpenGraphData } from '~redux/modules/user'

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

/**
 * Checks if URL is a YouTube video
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null
}

/**
 * Fetches YouTube video metadata using oEmbed API (no auth required)
 */
async function fetchYouTubeMetadata(url: string): Promise<OpenGraphData | null> {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(oEmbedUrl)

    if (!response.ok) {
      console.warn('[fetchOpenGraphData] YouTube oEmbed failed:', response.status)
      return null
    }

    const data = await response.json()
    const videoId = extractYouTubeVideoId(url)

    return {
      title: data.title,
      description: data.author_name ? `Par ${data.author_name}` : undefined,
      image: data.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined),
      siteName: 'YouTube',
      type: 'video',
      fetchedAt: Date.now(),
    }
  } catch (error) {
    console.error('[fetchOpenGraphData] YouTube fetch error:', error)
    return null
  }
}

/**
 * Fetches OpenGraph metadata for a URL
 *
 * For YouTube URLs: Uses oEmbed API (works without Cloud Function)
 * For other URLs: Requires Cloud Function to bypass CORS
 *
 * TODO: Deploy Cloud Function `fetchOpenGraph` to Firebase for non-YouTube URLs:
 *
 * ```typescript
 * // functions/src/fetchOpenGraph.ts
 * import * as functions from 'firebase-functions'
 * import fetch from 'node-fetch'
 * import { parse } from 'node-html-parser'
 *
 * export const fetchOpenGraph = functions.https.onCall(async (data, context) => {
 *   if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
 *   const { url } = data
 *   const response = await fetch(url, { headers: { 'User-Agent': 'BibleStrong/1.0' }, timeout: 10000 })
 *   const html = await response.text()
 *   const root = parse(html)
 *   // Parse og:title, og:description, og:image, etc.
 *   return { success: true, data: { ... } }
 * })
 * ```
 */
export async function fetchOpenGraphData(url: string): Promise<{
  ogData: OpenGraphData | null
  isYouTube: boolean
  youtubeVideoId: string | null
}> {
  // Validate URL
  try {
    new URL(url)
  } catch {
    return { ogData: null, isYouTube: false, youtubeVideoId: null }
  }

  const youtubeVideoId = extractYouTubeVideoId(url)
  const isYouTube = youtubeVideoId !== null

  // For YouTube, use oEmbed API (no CORS issues)
  if (isYouTube) {
    const ogData = await fetchYouTubeMetadata(url)
    return { ogData, isYouTube: true, youtubeVideoId }
  }

  // For other URLs, we would need a Cloud Function to bypass CORS
  // For now, return minimal data extracted from URL
  try {
    const urlObj = new URL(url)
    return {
      ogData: {
        title: undefined,
        description: undefined,
        image: undefined,
        siteName: urlObj.hostname.replace('www.', ''),
        type: 'website',
        fetchedAt: Date.now(),
      },
      isYouTube: false,
      youtubeVideoId: null,
    }
  } catch {
    return { ogData: null, isYouTube: false, youtubeVideoId: null }
  }
}

/**
 * Gets a display title for a link (custom title > OG title > URL hostname)
 */
export function getLinkDisplayTitle(link: {
  customTitle?: string
  ogData?: OpenGraphData
  url: string
}): string {
  if (link.customTitle) return link.customTitle
  if (link.ogData?.title) return link.ogData.title
  try {
    return new URL(link.url).hostname.replace('www.', '')
  } catch {
    return link.url
  }
}
