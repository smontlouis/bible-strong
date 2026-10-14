import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { CAPABILITIES } from './tools'

// The package submitted to the directory of plugins. What the portal refuses at upload is
// refused here first: the limits are the ones of its field reference.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../plugin')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const manifest = JSON.parse(read('plugin.json'))
const openai = manifest.extensions['com.openai']
const toolNames = new Set(
  CAPABILITIES.flatMap(capability => [capability.read.name, ...(capability.show ? [capability.show.name] : [])])
)

test('the listing fits the fields of the directory', () => {
  const { interface: listing } = openai
  assert.match(manifest.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/u)
  assert.ok(listing.displayName.length <= 30)
  assert.ok(listing.shortDescription.length <= 30)
  assert.ok(listing.longDescription.length <= 4000)
  // A name does not say what kind of thing it is.
  assert.doesNotMatch(listing.displayName, /mcp|plugin/iu)
  assert.ok(listing.defaultPrompt.length <= 3)
  for (const prompt of listing.defaultPrompt) assert.ok(prompt.length <= 128, prompt)
  assert.ok(listing.capabilities.length <= 20)
  for (const url of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    assert.match(listing[url], /^https:\/\/bible-strong\.app(?:\/|$)/u, url)
  }
  for (const color of [listing.brandColor, listing.brandColorDark]) assert.match(color, /^#[0-9A-F]{6}$/u)
  for (const image of [listing.logo, listing.composerIcon]) {
    assert.ok(existsSync(resolve(root, image)), image)
  }
  for (const [locale, text] of Object.entries<any>(openai.publication.translations)) {
    assert.ok(text.subtitle.length <= 30, locale)
    assert.ok(text.description.length <= 4000, locale)
  }
})

test('the review is given five cases to pass and three to refuse, on tools that exist', () => {
  const { positive, negative } = openai.review.test_cases
  assert.equal(positive.length, 5)
  assert.equal(negative.length, 3)
  for (const testCase of positive) {
    assert.ok(testCase.description && testCase.prompt && testCase.expected_behavior)
    for (const name of testCase.tools_triggered.split(',')) {
      assert.ok(toolNames.has(name.trim()), `${name} is not a tool of the server`)
    }
  }
  for (const testCase of negative) assert.ok(testCase.description && testCase.prompt)
  assert.equal(openai.review.commerce, false)
})

test('the package names one server, the one that is deployed, and asks for no sign-in', () => {
  const servers = Object.values<any>(JSON.parse(read('mcp.json')).mcpServers)
  assert.equal(servers.length, 1)
  assert.equal(servers[0].type, 'streamable-http')
  assert.equal(servers[0].url, 'https://mcp.bible-strong.app/mcp')
  assert.deepEqual(servers[0].extensions['com.openai'].auth, { type: 'none' })
  // The address of the server is part of the published plugin: the Worker answers at it.
  const wrangler = readFileSync(resolve(root, '../wrangler.jsonc'), 'utf8')
  assert.match(wrangler, /"pattern": "mcp\.bible-strong\.app"/u)
})

test('each skill is named after its folder and only calls tools that exist', () => {
  const skills = readdirSync(resolve(root, 'skills'))
  assert.ok(skills.length >= 1 && skills.length <= 5)
  for (const skill of skills) {
    const text = read(`skills/${skill}/SKILL.md`)
    const frontMatter = /^---\nname: (.+)\ndescription: (.+)\n---\n/u.exec(text)
    assert.ok(frontMatter, skill)
    assert.equal(frontMatter[1], skill)
    assert.ok(frontMatter[2]!.length > 80, skill)
    // Every word written as a tool is one.
    for (const [, name] of text.matchAll(/`((?:read|show|get|find|search|list)_[a-z_]+)`/gu)) {
      assert.ok(toolNames.has(name!), `${skill} calls ${name}`)
    }
  }
})
