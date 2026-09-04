/**
 * Sends a reply to a single Google Play review.
 *
 * Usage: npx tsx scripts/send-review-reply.ts <reviewId> <replyText>
 *
 * Requires: scripts/google-service-account.json
 */

import { google } from 'googleapis'
import * as path from 'path'

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? 'com.smontlouis.biblestrong'
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? path.join(__dirname, 'google-service-account.json')

async function main() {
  const reviewId = process.argv[2]
  const replyText = process.argv[3]

  if (!reviewId || !replyText) {
    console.error(JSON.stringify({ error: 'Usage: send-review-reply.ts <reviewId> <replyText>' }))
    process.exit(1)
  }

  if (replyText.length > 350) {
    console.error(JSON.stringify({ error: `Reply too long: ${replyText.length}/350 chars` }))
    process.exit(1)
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })

  const authClient = await auth.getClient()
  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth: authClient as any,
  })

  await androidPublisher.reviews.reply({
    packageName: PACKAGE_NAME,
    reviewId,
    requestBody: { replyText },
  })

  console.log(JSON.stringify({ success: true, reviewId }))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})
