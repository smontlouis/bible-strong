import { onRequest } from 'firebase-functions/v2/https'
import * as dns from 'dns'
import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as zlib from 'zlib'

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

// The page fetch runs inside Google's network: it must never reach an internal address.
// IPv4: "this" network, private, carrier-grade NAT, loopback, link-local (including the
// 169.254.169.254 metadata server), IETF, documentation, benchmark, multicast and reserved.
const blockedIPv4 = new net.BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockedIPv4.addSubnet(network, prefix, 'ipv4')
}
// IPv6: only global unicast, minus IETF assignments (Teredo…), documentation and 6to4.
// Loopback, unique local, link-local, multicast and NAT64 all fall outside 2000::/3.
const globalIPv6 = new net.BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')
const blockedIPv6 = new net.BlockList()
blockedIPv6.addSubnet('2001::', 23, 'ipv6')
blockedIPv6.addSubnet('2001:db8::', 32, 'ipv6')
blockedIPv6.addSubnet('2002::', 16, 'ipv6')

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return !blockedIPv4.check(address, 'ipv4')
  if (family !== 6) return false
  const mappedIPv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mappedIPv4) return isPublicAddress(mappedIPv4[1])
  return globalIPv6.check(address, 'ipv6') && !blockedIPv6.check(address, 'ipv6')
}

// Checked when the socket connects, so a DNS answer cannot change between check and use.
// Every address the name resolves to must be public.
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '')
    } else if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      callback(Object.assign(new Error(`blocked_address ${hostname}`), { code: 'EBLOCKED' }), '')
    } else if (options.all) {
      callback(null, addresses)
    } else {
      callback(null, addresses[0].address, addresses[0].family)
    }
  })
}

const MAX_REDIRECTS = 3
const MAX_HTML_BYTES = 1024 * 1024
const FETCH_TIMEOUT_MS = 10000
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export function assertFetchableUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported_protocol')
  if (url.username || url.password) throw new Error('credentials_in_url')
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('unsupported_port')
  // An IP literal never goes through the lookup: check it here.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && !isPublicAddress(host)) throw new Error('blocked_address')
}

function requestOnce(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const request = client.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        lookup: publicLookup,
        signal,
      },
      resolve
    )
    request.on('error', reject)
  })
}

// Metadata sits in <head>: past the cap, the beginning of the page is enough.
function readCappedBody(response: http.IncomingMessage): Promise<string> {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase()
  const body =
    encoding === 'gzip'
      ? response.pipe(zlib.createGunzip())
      : encoding === 'deflate'
        ? response.pipe(zlib.createInflate())
        : encoding === 'br'
          ? response.pipe(zlib.createBrotliDecompress())
          : response
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const finish = () => resolve(Buffer.concat(chunks).subarray(0, MAX_HTML_BYTES).toString('utf8'))
    body.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      size += chunk.length
      if (size >= MAX_HTML_BYTES) {
        finish()
        response.destroy()
        if (body !== response) body.destroy()
      }
    })
    body.on('end', finish)
    body.on('error', reject)
    response.on('error', reject)
  })
}

// Follows redirects by hand so that each new address goes through the same checks.
export async function fetchPublicHtml(rawUrl: string): Promise<{ status: number; html: string }> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  let url = new URL(rawUrl)
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    assertFetchableUrl(url)
    const response = await requestOnce(url, signal)
    const status = response.statusCode ?? 0
    const location = response.headers.location
    if (status >= 300 && status < 400 && location) {
      response.resume()
      url = new URL(location, url)
      continue
    }
    if (status < 200 || status >= 300) {
      response.resume()
      return { status, html: '' }
    }
    return { status, html: await readCappedBody(response) }
  }
  throw new Error('too_many_redirects')
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
    const response = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(5000) })

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
    maxInstances: 10,
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
        assertFetchableUrl(new URL(url))
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
      let page: { status: number; html: string }
      try {
        page = await fetchPublicHtml(url)
      } catch (error) {
        console.warn('fetchOpenGraph fetch refused or failed:', (error as Error).message)
        res.status(400).json({ error: 'fetch_failed' })
        return
      }

      if (page.status < 200 || page.status >= 300) {
        res.status(400).json({ error: 'fetch_failed', status: page.status })
        return
      }

      const scrapedData = await scraper({ html: page.html, url })

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
