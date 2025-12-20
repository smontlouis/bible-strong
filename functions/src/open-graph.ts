import { onRequest } from 'firebase-functions/v2/https'
import fetch from 'node-fetch'

const admin = require('firebase-admin')
const cors = require('cors')({ origin: true })
const scraper = require('metascraper')([
  require('metascraper-title')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-author')(),
])

export const fetchOpenGraph = onRequest((req, res) => {
  cors(req, res, async () => {
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

      // Fetch et parse avec timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BibleStrong/1.0)',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        res.status(400).json({ error: 'fetch_failed', status: response.status })
        return
      }

      const html = await response.text()
      const metadata = await scraper({ html, url })

      res.json({
        success: true,
        data: {
          title: metadata.title,
          description: metadata.description,
          image: metadata.image,
          logo: metadata.logo,
          author: metadata.author,
          siteName: new URL(url).hostname.replace('www.', ''),
          type: 'website',
          fetchedAt: Date.now(),
        },
      })
    } catch (error) {
      console.error('fetchOpenGraph error:', error)
      res.status(500).json({ error: 'internal_error' })
    }
  })
})
