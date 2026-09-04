/**
 * Fetches Google Play reviews and outputs them as JSON to stdout.
 *
 * Usage: npx tsx scripts/fetch-reviews.ts [--unreplied-only]
 *
 * Requires: scripts/google-service-account.json
 */

import { google } from 'googleapis'
import * as path from 'path'

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? 'com.smontlouis.biblestrong'
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? path.join(__dirname, 'google-service-account.json')
const UNREPLIED_ONLY = process.argv.includes('--unreplied-only')

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })

  const authClient = await auth.getClient()
  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth: authClient as any,
  })

  const allReviews: any[] = []
  let pageToken: string | undefined

  do {
    const response = await androidPublisher.reviews.list({
      packageName: PACKAGE_NAME,
      maxResults: 100,
      ...(pageToken ? { token: pageToken } : {}),
    })

    const reviews = response.data.reviews ?? []
    allReviews.push(...reviews)
    pageToken = response.data.tokenPagination?.nextPageToken ?? undefined
  } while (pageToken)

  let results = allReviews.map((r: any) => {
    const userComment = r.comments?.[0]?.userComment
    const devComment = r.comments?.find((c: any) => c.developerComment)?.developerComment

    return {
      reviewId: r.reviewId,
      authorName: r.authorName || 'Anonyme',
      starRating: userComment?.starRating,
      text: userComment?.text,
      language: userComment?.reviewerLanguage,
      date: userComment?.lastModified?.seconds
        ? new Date(Number(userComment.lastModified.seconds) * 1000).toISOString()
        : null,
      hasReply: !!devComment,
      existingReply: devComment?.text ?? null,
    }
  })

  if (UNREPLIED_ONLY) {
    results = results.filter(r => !r.hasReply)
  }

  console.log(JSON.stringify(results, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})
