import { onRequest } from 'firebase-functions/v2/https'

const admin = require('firebase-admin')
const scraper = require('metascraper')([
  require('metascraper-title')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-author')(),
])

type SocialProvider =
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'tiktok'
  | 'vimeo'
  | 'spotify'

// Détecte le provider social à partir de l'URL
function detectSocialProvider(url: string): SocialProvider | null {
  if (/instagram\.com\/(p|reel|tv|stories)\//.test(url)) return 'instagram'
  if (/(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url)) return 'youtube'
  if (/(?:twitter\.com|x\.com)\/\w+\/status\//.test(url)) return 'twitter'
  if (/tiktok\.com\/@[\w.]+\/video\//.test(url)) return 'tiktok'
  if (/vimeo\.com\/\d+/.test(url)) return 'vimeo'
  if (/open\.spotify\.com\/(track|album|playlist|episode|show)\//.test(url)) return 'spotify'
  return null
}

// URLs oEmbed par provider
function getOEmbedUrl(url: string, provider: SocialProvider): string {
  const encodedUrl = encodeURIComponent(url)
  switch (provider) {
    case 'instagram':
      return `https://api.instagram.com/oembed?url=${encodedUrl}`
    case 'youtube':
      return `https://www.youtube.com/oembed?url=${encodedUrl}&format=json`
    case 'twitter':
      return `https://publish.twitter.com/oembed?url=${encodedUrl}`
    case 'tiktok':
      return `https://www.tiktok.com/oembed?url=${encodedUrl}`
    case 'vimeo':
      return `https://vimeo.com/api/oembed.json?url=${encodedUrl}`
    case 'spotify':
      return `https://open.spotify.com/oembed?url=${encodedUrl}`
  }
}

// Noms affichés des providers
const providerNames: Record<SocialProvider, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter',
  tiktok: 'TikTok',
  vimeo: 'Vimeo',
  spotify: 'Spotify',
}

// Types de contenu par provider
const providerTypes: Record<SocialProvider, string> = {
  instagram: 'social',
  youtube: 'video',
  twitter: 'social',
  tiktok: 'video',
  vimeo: 'video',
  spotify: 'audio',
}

// Fetch metadata via oEmbed
async function fetchOEmbedMetadata(
  url: string,
  provider: SocialProvider
): Promise<{
  title?: string
  description?: string
  image?: string
  author?: string
  siteName: string
  type: string
} | null> {
  try {
    const oEmbedUrl = getOEmbedUrl(url, provider)
    const response = await fetch(oEmbedUrl)

    if (!response.ok) {
      console.warn(`oEmbed failed for ${provider}:`, response.status)
      return null
    }

    const data = await response.json()

    return {
      title: data.title,
      description: data.author_name ? `Par ${data.author_name}` : undefined,
      image: data.thumbnail_url,
      author: data.author_name,
      siteName: providerNames[provider],
      type: providerTypes[provider],
    }
  } catch (error) {
    console.error(`oEmbed error for ${provider}:`, error)
    return null
  }
}

export const fetchOpenGraph = onRequest(
  {
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    try {
      // Vérifier authentification via token Firebase
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' })
        return
      }

      const token = authHeader.split('Bearer ')[1]
      try {
        await admin.auth().verifyIdToken(token)
      } catch {
        res.status(401).json({ error: 'invalid_token' })
        return
      }

      // Valider URL
      const url = req.query.url as string
      if (!url) {
        res.status(400).json({ error: 'url_required' })
        return
      }

      try {
        new URL(url)
      } catch {
        res.status(400).json({ error: 'invalid_url' })
        return
      }

      // Détecter si c'est un réseau social avec oEmbed
      const provider = detectSocialProvider(url)

      if (provider) {
        const oEmbedData = await fetchOEmbedMetadata(url, provider)

        if (oEmbedData) {
          res.json({
            success: true,
            data: {
              ...oEmbedData,
              fetchedAt: Date.now(),
            },
          })
          return
        }
        // Si oEmbed échoue, on continue avec le scraping standard
      }

      // Scraping standard pour les autres URLs (Facebook, LinkedIn, GitHub, sites classiques)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        res.status(400).json({ error: 'fetch_failed', status: response.status })
        return
      }

      const html = await response.text()
      const scrapedData = await scraper({ html, url })

      res.json({
        success: true,
        data: {
          title: scrapedData.title,
          description: scrapedData.description,
          image: scrapedData.image,
          logo: scrapedData.logo,
          author: scrapedData.author,
          siteName: new URL(url).hostname.replace('www.', ''),
          type: 'website',
          fetchedAt: Date.now(),
        },
      })
    } catch (error) {
      console.error('fetchOpenGraph error:', error)
      res.status(500).json({ error: 'internal_error' })
    }
  }
)
