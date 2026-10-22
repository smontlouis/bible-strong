import { createHash, timingSafeEqual } from 'crypto'
import * as functions from 'firebase-functions/v1'
const admin = require('firebase-admin')

// IAPHUB still sends the events of the subscriptions taken in the apps that sold them
// (renewals, expirations): they keep `subscription` up to date on the user document. Each
// request carries the token of the webhook, shown in the IAPHUB dashboard, in `X-Auth-Token`;
// it is kept as the secret below (`firebase functions:secrets:set IAPHUB_WEBHOOK_TOKEN`).
const WEBHOOK_TOKEN_SECRET = 'IAPHUB_WEBHOOK_TOKEN'

// Both tokens are hashed first so that they compare in constant time whatever their length.
const isWebhookToken = (received: string | undefined): boolean => {
  const expected = process.env[WEBHOOK_TOKEN_SECRET]
  if (!received || !expected) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(received), digest(expected))
}

// Subscription type: 'basic' | 'premium' | 'premium_plus' | 'investor'

type EventType =
  | 'purchase'
  | 'refund'
  | 'subscription_renewal'
  | 'subscription_replace'
  | 'subscription_cancel'
  | 'subscription_uncancel'
  | 'subscription_expire'
  | 'user_id_update'

interface Event {
  id: string
  type: EventType
  createdDate: string
  version: string
  data: {
    id: string
    purchaseDate: string
    quantity: number
    platform: string
    country: string
    tags: {}
    orderId: string
    app: string
    user: string
    userId: string
    product: string
    productSku: string
    productType: string
    listing: string
    store: string
    currency: string
    price: number
    convertedCurrency: string
    convertedPrice: number
    isSandbox: false
    isRefunded: false
    isSubscription: false
  }
}

const getSubscriptionBySku = (sku: string) => {
  switch (sku) {
    case 'com.smontlouis.biblestrong.onemonth.min': {
      return 'basic'
    }
    case 'com.smontlouis.biblestrong.onemonth': {
      return 'premium'
    }
    case 'com.smontlouis.biblestrong.onemonth.max': {
      return 'premium_plus'
    }
    default: {
      return 'basic'
    }
  }
}

export const iaphub = functions
  .runWith({ secrets: [WEBHOOK_TOKEN_SECRET] })
  .https.onRequest(async (req, res) => {
    try {
      if (!isWebhookToken(req.get('x-auth-token'))) {
        console.warn('[iaphub] request without a valid webhook token refused')
        res.status(401).send('Unauthorized')
        return
      }
      if (req.method === 'POST') {
        const event: Event = req.body
        // A purchase made without an account, or by an account deleted since, has no document
        // to keep up to date: it is acknowledged, so that IAPHUB does not send it again.
        const userId = event?.data?.userId
        if (!userId) {
          res.json({ type: event?.type, ignored: 'no-user' })
          return
        }

        switch (event.type) {
          case 'subscription_renewal':
          case 'purchase': {
            const user = await admin.firestore().collection('users').doc(userId)

            const { exists } = await user.get()

            if (!exists) {
              res.json({ type: event.type, ignored: 'unknown-user' })
              return
            }

            const subscription = getSubscriptionBySku(event.data.productSku)
            await user.update({ subscription })
            break
          }
          case 'subscription_expire': {
            const user = await admin.firestore().collection('users').doc(userId)

            const { exists } = await user.get()

            if (!exists) {
              res.json({ type: event.type, ignored: 'unknown-user' })
              return
            }

            await user.update({ subscription: null })
            break
          }
          default:
            break
        }
        res.json({ type: event.type })
      } else {
        res.json('Nothing to see here.')
      }
    } catch (error) {
      console.error('[iaphub] event not applied', error)
      res.status(500).send('Event not applied')
    }
  })
