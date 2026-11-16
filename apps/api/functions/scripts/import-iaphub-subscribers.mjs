#!/usr/bin/env node
// Hands the former sponsorships still renewing through IAPHUB over to RevenueCat (ADR-0110,
// « Former sponsorships become Premium »): each active subscription is sent to RevenueCat under
// the Firebase uid IAPHUB holds, and RevenueCat then follows its renewals itself.
//
//   node --env-file=.env --env-file=apps/expo/.env.production \
//     apps/api/functions/scripts/import-iaphub-subscribers.mjs [--apply] [--report <file.json>]
//
// Without --apply it only reads IAPHUB and says what it would import. Needs
// IAPHUB_SERVER_API_KEY (root .env) and the public RevenueCat keys of the stores
// (EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY).

import { writeFileSync } from 'node:fs'

const IAPHUB_APP_ID = '5ed06418e719240e7fdf5d48'
const IAPHUB_URL = `https://api.iaphub.com/v1/app/${IAPHUB_APP_ID}/subscriptions`
const REVENUECAT_URL = 'https://api.revenuecat.com/v1'
const ENTITLEMENT = 'premium'
// IAPHUB allows 5 requests a second per route; RevenueCat is kept to the same pace.
const PAUSE_MS = 250

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const reportIndex = args.indexOf('--report')
const reportPath = reportIndex === -1 ? undefined : args[reportIndex + 1]

const required = name => {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is not set`)
    process.exit(1)
  }
  return value
}
const iaphubKey = required('IAPHUB_SERVER_API_KEY')
const revenueCatKeys = {
  ios: required('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'),
  android: required('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'),
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function iaphubPage(page, pageId) {
  const url = new URL(IAPHUB_URL)
  url.searchParams.set('filterExpired', 'true')
  url.searchParams.set('limit', '100')
  url.searchParams.set('page', String(page))
  if (pageId) url.searchParams.set('pageId', pageId)
  const response = await fetch(url, { headers: { Authorization: `ApiKey ${iaphubKey}` } })
  if (!response.ok) throw new Error(`IAPHUB answered ${response.status} ${await response.text()}`)
  return response.json()
}

async function activeSubscriptions() {
  const all = []
  let page = 1
  let pageId
  for (;;) {
    const { list = [], hasNextPage, nextPageId } = await iaphubPage(page, pageId)
    all.push(...list)
    if (!hasNextPage) return all
    page += 1
    pageId = nextPageId
    await wait(PAUSE_MS)
  }
}

// The token RevenueCat needs to look the subscription up at the store itself.
const fetchToken = subscription =>
  subscription.platform === 'ios'
    ? subscription.iosOriginalTransactionId || subscription.iosTransactionId
    : subscription.androidToken

async function revenueCat(platform, path, init = {}) {
  const response = await fetch(`${REVENUECAT_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${revenueCatKeys[platform]}`,
      'X-Platform': platform,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, body }
}

const premiumOf = body => body?.subscriber?.entitlements?.[ENTITLEMENT]
const isActive = entitlement =>
  Boolean(entitlement) &&
  (!entitlement.expires_date || new Date(entitlement.expires_date) > new Date())

const subscriptions = await activeSubscriptions()

// One line per account and store subscription: IAPHUB returns the latest transaction of each.
const seen = new Set()
const candidates = []
const skipped = []
for (const subscription of subscriptions) {
  const reason = subscription.isSandbox
    ? 'sandbox'
    : !subscription.userId
      ? 'no-account'
      : !['ios', 'android'].includes(subscription.platform)
        ? `platform-${subscription.platform}`
        : !fetchToken(subscription)
          ? 'no-store-token'
          : undefined
  if (reason) {
    skipped.push({ reason, platform: subscription.platform, productSku: subscription.productSku })
    continue
  }
  const key = `${subscription.userId}:${fetchToken(subscription)}`
  if (seen.has(key)) continue
  seen.add(key)
  candidates.push(subscription)
}

const count = (items, pick) =>
  items.reduce((counts, item) => {
    const value = pick(item)
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})

console.log(`IAPHUB active subscriptions: ${subscriptions.length}`)
console.log(`To import: ${candidates.length}`, count(candidates, s => s.platform))
console.log('  by product:', count(candidates, s => s.productSku))
console.log('  by state:', count(candidates, s => s.subscriptionState))
console.log(`Skipped: ${skipped.length}`, count(skipped, s => s.reason))

const results = []
if (apply) {
  for (const subscription of candidates) {
    const { platform, userId, productSku } = subscription
    const sent = await revenueCat(platform, '/receipts', {
      method: 'POST',
      body: JSON.stringify({
        app_user_id: userId,
        fetch_token: fetchToken(subscription),
        ...(platform === 'android' ? { product_id: productSku } : {}),
      }),
    })
    await wait(PAUSE_MS)
    const read = await revenueCat(platform, `/subscribers/${encodeURIComponent(userId)}`)
    await wait(PAUSE_MS)
    const premium = premiumOf(read.body)
    results.push({
      userId,
      platform,
      productSku,
      imported: sent.ok,
      status: sent.status,
      error: sent.ok ? undefined : sent.body?.message || sent.body?.code,
      premiumActive: isActive(premium),
      premiumExpires: premium?.expires_date ?? null,
    })
  }
  console.log('Imported:', count(results, r => (r.imported ? 'ok' : `failed-${r.status}`)))
  console.log('Premium active afterwards:', count(results, r => String(r.premiumActive)))
} else {
  console.log('Dry run: nothing sent to RevenueCat. Add --apply to import.')
}

if (reportPath) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        apply,
        candidates: candidates.map(s => ({
          userId: s.userId,
          platform: s.platform,
          productSku: s.productSku,
          state: s.subscriptionState,
          expirationDate: s.expirationDate,
        })),
        skipped,
        results,
      },
      null,
      2
    )
  )
  console.log(`Report written to ${reportPath}`)
}
