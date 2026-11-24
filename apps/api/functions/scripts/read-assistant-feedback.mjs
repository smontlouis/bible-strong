#!/usr/bin/env node
// Reads what readers think of the study assistant while it is in beta: the thumbs given on
// answers and the opinions on Strobi as a whole, which the app writes under each account
// (`users/{uid}/assistantFeedback`, see apps/expo/src/features/study-assistant/README.md).
//
//   node apps/api/functions/scripts/read-assistant-feedback.mjs [options]
//
//   --since <YYYY-MM-DD>   only the opinions given from that day on
//   --rating up|down       only those thumbs
//   --kind answer|general  only the opinions on an answer, or on Strobi as a whole
//   --commented            only those with a comment or a reason
//   --full                 print the whole question and answer, not their first lines
//   --json <file>          also write everything that matched to a file
//
// It only reads. It needs a service account of the Firebase project: apps/api/serviceAccountKey.json
// by default, or the file GOOGLE_APPLICATION_CREDENTIALS names.
//
// Every opinion is read on each run, then sorted and filtered here: the collection group has no
// index, and none is needed while there are a few thousand of them. One read is billed per
// opinion; past that size, index `createdAt` for the collection group and filter in the query.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const flag = name => args.includes(`--${name}`)
const option = name => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const fail = message => {
  console.error(message)
  process.exit(1)
}

const since = option('since')
const sinceTime = since ? Date.parse(`${since}T00:00:00`) : 0
if (Number.isNaN(sinceTime)) fail(`--since expects a day such as 2026-11-24, not « ${since} »`)
const rating = option('rating')
if (rating && !['up', 'down'].includes(rating)) fail('--rating expects up or down')
const kind = option('kind')
if (kind && !['answer', 'general'].includes(kind)) fail('--kind expects answer or general')

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  fileURLToPath(new URL('../../serviceAccountKey.json', import.meta.url))
let key
try {
  key = JSON.parse(readFileSync(keyPath, 'utf8'))
} catch {
  fail(`No service account at ${keyPath}`)
}
initializeApp({ credential: cert(key) })

const snapshot = await getFirestore().collectionGroup('assistantFeedback').get()
const all = snapshot.docs
  // The same name could one day be used elsewhere: only the folders of accounts count.
  .filter(doc => doc.ref.parent.parent?.parent.id === 'users')
  .map(doc => ({ uid: doc.ref.parent.parent.id, id: doc.id, ...doc.data() }))

const commented = item => Boolean(item.comment || item.reasons?.length)
const opinions = all
  .filter(item => (item.createdAt || 0) >= sinceTime)
  .filter(item => !rating || item.rating === rating)
  .filter(item => !kind || item.kind === kind)
  .filter(item => !flag('commented') || commented(item))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

const count = (items, key) => {
  const counts = {}
  for (const item of items) for (const value of [item[key]].flat()) {
    if (value) counts[value] = (counts[value] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, total]) => `${value} ${total}`)
    .join(', ')
}

const answers = opinions.filter(item => item.kind === 'answer')
const up = answers.filter(item => item.rating === 'up').length
const down = answers.filter(item => item.rating === 'down').length
console.log(`${opinions.length} opinions of ${all.length}${since ? ` since ${since}` : ''}`)
console.log(`  on an answer: ${answers.length} (up ${up}, down ${down})`)
console.log(`  on Strobi as a whole: ${opinions.length - answers.length}`)
console.log(`  with a comment or a reason: ${opinions.filter(commented).length}`)
console.log(`  accounts: ${new Set(opinions.map(item => item.uid)).size}`)
for (const [label, key] of [
  ['reasons', 'reasons'],
  ['platforms', 'platform'],
  ['languages', 'language'],
  ['versions', 'appVersion'],
]) {
  const line = count(opinions, key)
  if (line) console.log(`  ${label}: ${line}`)
}

const day = time => (time ? new Date(time).toISOString().slice(0, 16).replace('T', ' ') : '?')
const excerpt = text => {
  if (flag('full')) return String(text)
  const flat = String(text).replace(/\s+/g, ' ').trim()
  return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat
}
for (const item of opinions) {
  const what = item.kind === 'general' ? 'general' : item.rating === 'up' ? '👍' : '👎'
  const where = [item.platform, item.appVersion, item.language].filter(Boolean).join(' ')
  console.log(`\n── ${day(item.createdAt)}  ${what}  ${where}  ${item.uid}`)
  if (item.reasons?.length) console.log(`reasons: ${item.reasons.join(', ')}`)
  if (item.comment) console.log(`comment: ${item.comment}`)
  if (item.question) console.log(`question: ${excerpt(item.question)}`)
  if (item.answer) console.log(`answer: ${excerpt(item.answer)}`)
}

const jsonPath = option('json')
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(opinions, null, 2))
  console.log(`\n${opinions.length} opinions written to ${jsonPath}`)
}
