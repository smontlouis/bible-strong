import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rulesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../firestore.rules'
)

test('keeps private user data out of the authenticated global read scope', async () => {
  const rules = await readFile(rulesPath, 'utf8')
  assert.doesNotMatch(rules, /^\s*match \/\{document=\*\*\}/mu)
  assert.match(rules, /allow read, write: if owns\(userId\);/u)
  assert.match(rules, /collectionName != 'assistantConversations'/u)
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
