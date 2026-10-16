import assert from 'node:assert/strict'
import test from 'node:test'

import { createMcpHandler } from '@modelcontextprotocol/server'
import { targets } from '../widgets/src/targets'
import { CARD_META_KEY } from './cards/types'
import { createSiteLinks } from './links'
import { ResourceApiError, type ResourceReader } from './resourceApi'
import { CARD_MIME_TYPE, cardUri, createStudyServer } from './server'
import { CAPABILITIES } from './tools'

// --- A Resource API that answers from a table --------------------------------------

type Answers = Record<string, unknown>

const readerOf = (answers: Answers, asked: string[] = []): ResourceReader => {
  const answer = async <T>(path: string): Promise<T | undefined> => {
    asked.push(path)
    const found = answers[path]
    if (found instanceof Error) throw found
    return found as T | undefined
  }
  return { get: path => answer(path), post: path => answer(path) }
}

const verse = (number: number, text: string) => ({
  number,
  text,
  presentation: { startTags: [], layout: [], notes: [], headings: [] },
})

const JOHN_3 = {
  resource: { kind: 'bible-text', versionId: 'LSG', revision: 'r' },
  book: 43,
  chapter: 3,
  verses: [verse(15, 'afin que quiconque croit'), verse(16, 'Car Dieu a tant aimé le monde'), verse(17, 'Dieu, en effet')],
}

// --- A client that speaks to the server as a host does ------------------------------

const clientOf = (answers: Answers, asked: string[] = []) => {
  const handler = createMcpHandler(() =>
    createStudyServer({
      api: readerOf(answers, asked),
      links: createSiteLinks('https://bible-strong.app'),
      cardHtml: '<!doctype html><title>card</title>',
      cardDomain: 'https://mcp.bible-strong.app',
    })
  )
  let id = 0
  return async <T = any>(method: string, params: unknown = {}): Promise<T> => {
    const response = await handler.fetch(
      new Request('https://mcp.bible-strong.app/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      })
    )
    const body = await response.text()
    const message = JSON.parse(
      response.headers.get('content-type')?.includes('event-stream')
        ? body
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .join('')
        : body
    )
    assert.equal(message.error, undefined, JSON.stringify(message.error))
    return message.result as T
  }
}

const call = (client: ReturnType<typeof clientOf>, name: string, args: unknown, locale = 'fr-FR') =>
  client('tools/call', { name, arguments: args, _meta: { 'openai/locale': locale } })

// --- What the server tells a host about itself ---------------------------------------

test('every tool says what it is, that it only reads, and what it answers', async () => {
  const { tools } = await clientOf({})('tools/list')
  const names = tools.map((tool: any) => tool.name)
  assert.equal(new Set(names).size, names.length)
  assert.equal(
    names.length,
    CAPABILITIES.reduce((total, capability) => total + (capability.show ? 2 : 1), 0)
  )
  for (const tool of tools) {
    assert.match(tool.name, /^[a-z]+(?:_[a-z]+)+$/u, tool.name)
    assert.ok(tool.title, tool.name)
    assert.ok(tool.description.length > 60, tool.name)
    assert.deepEqual(
      tool.annotations,
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      tool.name
    )
    assert.equal(tool.inputSchema.type, 'object', tool.name)
    assert.equal(tool.outputSchema.type, 'object', tool.name)
    // What a host shows while a tool runs has room for 64 characters.
    for (const key of ['openai/toolInvocation/invoking', 'openai/toolInvocation/invoked']) {
      assert.ok(tool._meta[key].length <= 64, `${tool.name} ${key}`)
    }
  }
})

test('a host is told, in what it reads first, to show one card an answer', async () => {
  const { instructions } = await clientOf({})('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  })
  // ChatGPT keeps the first 512 characters of the instructions above the rest.
  const first = instructions.slice(0, 512)
  assert.match(first, /In each answer show one card: call the show_\* tool/u)
  assert.match(first, /twins without show_, which display nothing\./u)
  assert.match(first, /Never quote Scripture/u)
})

test('a tool that shows a card names it, and the card is there to be read', async () => {
  const client = clientOf({})
  const { tools } = await client('tools/list')
  const { resources } = await client('resources/list')
  const shown = CAPABILITIES.flatMap(capability => (capability.show ? [capability.show] : []))
  assert.equal(resources.length, shown.length)

  for (const show of shown) {
    const uri = cardUri(show.card)
    const tool = tools.find((candidate: any) => candidate.name === show.name)
    assert.equal(tool._meta.ui.resourceUri, uri)
    assert.equal(tool._meta['ui/resourceUri'], uri)

    const { contents } = await client('resources/read', { uri })
    assert.equal(contents[0].mimeType, CARD_MIME_TYPE)
    assert.match(contents[0].text, /^<!doctype html>/u)
    assert.equal(contents[0]._meta.ui.domain, 'https://mcp.bible-strong.app')
    assert.equal(contents[0]._meta.ui.prefersBorder, true)
    // A card asks the network for nothing but the pictures it shows.
    assert.deepEqual(contents[0]._meta.ui.csp.connectDomains, [])
    assert.deepEqual(contents[0]._meta.ui.csp.resourceDomains, show.pictures ?? [])
    // A card starts in the conversation, and may be opened on the whole screen.
    assert.deepEqual(contents[0]._meta['openai/ui'], {
      availableDisplayModes: ['inline', 'fullscreen'],
      preferredDisplayMode: 'inline',
    })
  }
  // A tool that only reads shows nothing.
  const read = tools.find((candidate: any) => candidate.name === 'read_passage')
  assert.equal(read._meta.ui, undefined)
})

test('what a card opens next is always a tool that reads without showing', () => {
  const readTools = new Set(CAPABILITIES.map(capability => capability.read.name))
  const go = targets('fr')
  const opened = [
    go.passage('John.3.16', 'Jean 3:16'),
    go.words('John.3.16', 'Jean 3:16'),
    go.strong('G0026'),
    go.occurrences('G0026', 'G26'),
    go.commentaries('John.3.16', 'Jean 3:16'),
    go.crossReferences('John.3.16', 'Jean 3:16'),
    go.dictionary('bost', 1, 'Aaron'),
    go.topic('love'),
    go.event('sarah', 'Sara'),
    go.period(9, 'La vie de Christ'),
    go.entity('Adam@Gen.2.19-Jud', 'Adam'),
  ]
  for (const target of opened) assert.ok(readTools.has(target.tool), target.tool)
})

// --- A passage, from the request to the card -------------------------------------------

test('a passage answers the model with its text and the person with a card', async () => {
  const asked: string[] = []
  const client = clientOf({ '/v1/bibles/LSG/books/43/chapters/3': JOHN_3 }, asked)
  const result = await call(client, 'show_passage', { reference: 'Jean 3:16-17' })

  assert.equal(result.isError, undefined)
  assert.deepEqual(asked, ['/v1/bibles/LSG/books/43/chapters/3'])
  assert.match(result.content[0].text, /Jean 3:16-17 — Bible Segond 1910 \(LSG\)/u)
  assert.match(result.content[0].text, /Car Dieu a tant aimé le monde/u)
  assert.doesNotMatch(result.content[0].text, /quiconque croit/u)
  assert.deepEqual(result.structuredContent, {
    reference: 'Jean 3:16-17',
    osis: 'John.3.16-John.3.17',
    url: 'https://bible-strong.app/bible/lsg/john/3/16-17',
    readings: [
      {
        version: 'LSG',
        versionName: 'Bible Segond 1910',
        verses: [
          { reference: 'Jean 3:16', text: 'Car Dieu a tant aimé le monde' },
          { reference: 'Jean 3:17', text: 'Dieu, en effet' },
        ],
      },
    ],
  })

  const card = result._meta[CARD_META_KEY]
  assert.equal(card.kind, 'passage')
  assert.equal(card.title, 'Jean 3:16-17')
  assert.deepEqual(
    card.columns[0].sections[0].verses.map((item: any) => item.number),
    [16, 17]
  )
})

test('the language of an answer is the one asked for, then the one of the host', async () => {
  const answers = { '/v1/bibles/KJV/books/43/chapters/3': JOHN_3, '/v1/bibles/LSG/books/43/chapters/3': JOHN_3 }
  const english = await call(clientOf(answers), 'read_passage', { reference: 'John 3:16' }, 'en-US')
  assert.equal(english.structuredContent.reference, 'John 3:16')
  assert.equal(english.structuredContent.readings[0].version, 'KJV')

  const asked = await call(clientOf(answers), 'read_passage', { reference: 'John 3:16', language: 'fr' }, 'en-US')
  assert.equal(asked.structuredContent.reference, 'Jean 3:16')
  assert.equal(asked.structuredContent.readings[0].version, 'LSG')
})

// --- What goes wrong is said in words the model can act on ----------------------------

test('a request that reads as nothing says how to write it', async () => {
  const client = clientOf({})
  const reference = await call(client, 'read_passage', { reference: 'bonjour' })
  assert.equal(reference.isError, true)
  assert.match(reference.content[0].text, /does not read as a Bible reference/u)

  const version = await call(client, 'read_passage', { reference: 'Jean 3:16', versions: ['XYZ'] })
  assert.match(version.content[0].text, /"XYZ" is not a Bible version/u)

  const strong = await call(client, 'get_strong_entry', { code: 'amour' })
  assert.match(strong.content[0].text, /is not a Strong number/u)

  const missing = await call(client, 'read_passage', { reference: 'Jean 3:16' })
  assert.match(missing.content[0].text, /was not found in LSG/u)
})

test('a failure of the Resource API is told without its details', async () => {
  const limited = await call(
    clientOf({ '/v1/bibles/LSG/books/43/chapters/3': new ResourceApiError(429, '/v1/bibles') }),
    'read_passage',
    { reference: 'Jean 3:16' }
  )
  assert.equal(limited.isError, true)
  assert.match(limited.content[0].text, /too many requests/u)

  const broken = await call(
    clientOf({ '/v1/bibles/LSG/books/43/chapters/3': new Error('connection reset by 10.0.0.1') }),
    'read_passage',
    { reference: 'Jean 3:16' }
  )
  assert.equal(broken.isError, true)
  assert.doesNotMatch(broken.content[0].text, /10\.0\.0\.1/u)
})

test('an input outside its schema is refused before anything is read', async () => {
  const asked: string[] = []
  const result = await call(clientOf({}, asked), 'read_passage', { reference: 'Jean 3:16', versions: [] })
  assert.equal(result.isError, true)
  assert.deepEqual(asked, [])
})
