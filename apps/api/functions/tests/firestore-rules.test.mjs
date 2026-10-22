import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rulesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../firestore.rules'
)

// The body of one `match` block, up to the next sibling `match` at the same depth.
const block = (rules, path) => {
  const start = rules.indexOf(`    match ${path} {`)
  assert.notEqual(start, -1, `missing match ${path}`)
  const end = rules.indexOf('\n    match ', start + 1)
  return rules.slice(start, end === -1 ? undefined : end)
}

test('keeps private user data out of the authenticated global read scope', async () => {
  const rules = await readFile(rulesPath, 'utf8')
  assert.doesNotMatch(rules, /^\s*match \/\{document=\*\*\}/mu)
  assert.match(block(rules, '/users/{userId}'), /allow read, delete: if owns\(userId\);/u)
  assert.match(rules, /collectionName != 'assistantConversations'/u)
  assert.match(block(rules, '/users-status/{userId}'), /allow read, write: if owns\(userId\);/u)
})

test('keeps the server-owned subscription out of client writes', async () => {
  const users = block(await readFile(rulesPath, 'utf8'), '/users/{userId}')
  assert.doesNotMatch(users, /allow[^;]*write/u)
  assert.match(users, /allow create: if owns\(userId\) && request\.resource\.data\.get\('subscription', null\) == null;/u)
  assert.match(users, /affectedKeys\(\)\.hasAny\(\['subscription'\]\)/u)
})

test('limits studies to their author unless published', async () => {
  const studies = block(await readFile(rulesPath, 'utf8'), '/studies/{studyId}')
  assert.doesNotMatch(studies, /allow read/u)
  assert.match(studies, /allow get: if resource\.data\.published == true \|\| ownsStudy\(resource\.data\);/u)
  assert.match(studies, /allow list: if ownsStudy\(resource\.data\);/u)
  assert.match(studies, /allow create: if ownsStudy\(request\.resource\.data\);/u)
  assert.match(studies, /allow update: if ownsStudy\(resource\.data\) && ownsStudy\(request\.resource\.data\);/u)
})

test('leaves public collections read-only except the plan download counter', async () => {
  const rules = await readFile(rulesPath, 'utf8')
  assert.doesNotMatch(block(rules, '/commentaries-FR/{commentaryId}'), /write/u)
  const plans = block(rules, '/plans/{document=**}')
  assert.match(plans, /hasOnly\(\['downloads'\]\)/u)
  assert.match(plans, /request\.resource\.data\.downloads == resource\.data\.get\('downloads', 0\) \+ 1;/u)
  assert.doesNotMatch(rules, /allow [^:]*(create|update|write|delete)[^:]*: if true;/u)
})

test('validates owner-scoped assistant conversations and terminal turns', async () => {
  const rules = await readFile(rulesPath, 'utf8')
  assert.match(
    rules,
    /match \/users\/\{userId\}\/assistantConversations\/\{conversationId\}/u
  )
  assert.match(rules, /allow create, update: if owns\(userId\) && validConversation\(\);/u)
  assert.match(rules, /match \/users\/\{userId\}\/assistantConversations\/\{conversationId\}\/turns\/\{turnId\}/u)
  assert.match(rules, /\['complete', 'interrupted', 'error'\]/u)
})
