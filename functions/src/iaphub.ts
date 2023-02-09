import * as functions from 'firebase-functions'
const admin = require('firebase-admin')

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

export const iaphub = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method === 'POST') {
      const event: Event = req.body

      switch (event.type) {
        case 'subscription_renewal':
        case 'purchase': {
          const user = await admin
            .firestore()
            .collection('users')
            .doc(event.data.userId)

          const { exists } = await user.get()

          if (!exists) {
            res.status(400).send('User does not exist.')
          }

          const subscription = getSubscriptionBySku(event.data.productSku)
          await user.update({ subscription })
          break
        }
        case 'subscription_expire': {
          const user = await admin
            .firestore()
            .collection('users')
            .doc(event.data.userId)

          const { exists } = await user.get()

          if (!exists) {
            res.status(400).send('User does not exist.')
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
    res.status(500).send(error)
  }
})
