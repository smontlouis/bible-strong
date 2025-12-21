import { getAuth } from '@react-native-firebase/auth'
import { Link, LinkType, OpenGraphData } from '~redux/modules/user'

const FUNCTION_URL = 'https://us-central1-bible-strong-app.cloudfunctions.net/fetchOpenGraph'

/**
 * Détecte le type de lien à partir de l'URL
 */
export function detectLinkType(url: string): LinkType {
  try {
    const hostname = new URL(url).hostname.toLowerCase()

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube'
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter'
    if (hostname.includes('instagram.com')) return 'instagram'
    if (hostname.includes('tiktok.com')) return 'tiktok'
    if (hostname.includes('vimeo.com')) return 'vimeo'
    if (hostname.includes('spotify.com')) return 'spotify'
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'facebook'
    if (hostname.includes('linkedin.com')) return 'linkedin'
    if (hostname.includes('github.com')) return 'github'

    return 'website'
  } catch {
    return 'website'
  }
}

/**
 * Extrait l'ID vidéo pour les plateformes vidéo
 */
export function extractVideoId(url: string, linkType: LinkType): string | null {
  // YouTube patterns
  if (linkType === 'youtube') {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match?.[1]) return match[1]
    }
  }

  // Vimeo
  if (linkType === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/)
    if (match?.[1]) return match[1]
  }

  // TikTok
  if (linkType === 'tiktok') {
    const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
    if (match?.[1]) return match[1]
  }

  return null
}

/**
 * Valide si une chaîne est une URL valide
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Fetch OG data via Cloud Function
 * Retourne null si offline, URL invalide, ou erreur (pas grave)
 */
export async function fetchOpenGraphData(url: string): Promise<OpenGraphData | null> {
  if (!isValidUrl(url)) {
    return null
  }

  try {
    const user = getAuth().currentUser
    if (!user) return null

    const token = await user.getIdToken()
    const response = await fetch(`${FUNCTION_URL}?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) return null

    const { data } = await response.json()
    return {
      ...data,
      fetchedAt: Date.now(),
    }
  } catch {
    // Offline ou erreur - pas grave
    return null
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

/**
 * Mapping des icônes par type de lien
 */
export const linkTypeConfig: Record<LinkType, { icon: string; color: string; textIcon?: string }> = {
  youtube: { icon: 'youtube', color: '#FF0000' },
  twitter: { icon: 'twitter', color: '#000000', textIcon: '𝕏' },
  instagram: { icon: 'instagram', color: '#E4405F' },
  tiktok: { icon: 'music', color: '#000000' },
  vimeo: { icon: 'video', color: '#1AB7EA' },
  spotify: { icon: 'music', color: '#1DB954' },
  facebook: { icon: 'facebook', color: '#1877F2' },
  linkedin: { icon: 'linkedin', color: '#0A66C2' },
  github: { icon: 'github', color: '#333333' },
  website: { icon: 'link', color: '#888888' },
}

/**
 * Retourne l'icône et la couleur pour un lien
 */
export function getLinkIcon(link: Link): { icon: string; color: string; textIcon?: string } {
  return linkTypeConfig[link.linkType] || linkTypeConfig.website
}
