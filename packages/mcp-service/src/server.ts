import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import { CARD_META_KEY, type CardKind } from './cards/types'
import { studyLanguageOf } from './language'
import type { SiteLinks } from './links'
import { ResourceApiError, type ResourceReader } from './resourceApi'
import { StudyError, type StudyContext } from './study'
import { CAPABILITIES, type Capability } from './tools'

/** The media type of a card, as MCP Apps names it. */
export const CARD_MIME_TYPE = 'text/html;profile=mcp-app'

/**
 * The address of a card. A host keeps a card under its address: when the document changes
 * in a way a kept copy would break, the version in the address is raised.
 */
export const cardUri = (card: CardKind): string =>
  `ui://bible-strong/v1/${card.replaceAll('_', '-')}.html`

export type StudyServerOptions = {
  api: ResourceReader
  links: SiteLinks
  /** The built document every card is drawn by. */
  cardHtml: string
  /** The origin a host frames the cards under, when it asks for one of our own. */
  cardDomain?: string
}

/**
 * What a host reads first weighs most, and ChatGPT keeps the first 512 characters above
 * the rest: what the server reads, then the rule of the cards, stand there.
 */
export const INSTRUCTIONS =
  'Bible Strong reads exact Bible text and study resources: Bibles, the Strong lexicon, ' +
  'original words, dictionaries, commentaries, topics, cross-references, a timeline, people ' +
  'and places. In each answer show one card: call the show_* tool for the main thing the ' +
  'question is about (a passage, word, person, place, event or topic); read everything else ' +
  'with the twins without show_, which display nothing. Never quote Scripture, a definition ' +
  'or a commentary from memory: read it with a tool, then cite the reference and the ' +
  'version. Show a second card only when the user asks to see several things, and none when ' +
  'the question is not about the Bible. After a card, comment on it instead of repeating ' +
  'it. Write each passage, word or article you cite as a link to the `url` its tool ' +
  'returned; never build an address yourself. ' +
  'Pass `language` ("fr" or "en") as the user writes. ' +
  'An `osis` value returned by a tool can be passed back as any `reference`. ' +
  'Report what the resources say and name their authors; do not present a commentary as the ' +
  'only reading of a passage.'

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  // Every tool reads the published catalog of Bible Strong, and nothing outside it.
  openWorldHint: false,
  idempotentHint: true,
} as const

const failure = (text: string) => ({ isError: true as const, content: [{ type: 'text' as const, text }] })

/** What the model is told when a reading fails: something it can act on, never a trace. */
const explain = (cause: unknown) => {
  if (cause instanceof StudyError) return failure(cause.message)
  if (cause instanceof ResourceApiError) {
    console.error(JSON.stringify({ message: 'resource api failure', status: cause.status, path: cause.path }))
    if (cause.status === 429) {
      return failure('Bible Strong is receiving too many requests. Try again in a minute.')
    }
    if (cause.status === 400) {
      return failure('Bible Strong could not read this request. Check the reference or the code given.')
    }
    return failure('Bible Strong is temporarily unavailable. Try again in a moment.')
  }
  console.error(
    JSON.stringify({
      message: 'tool failure',
      error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
    })
  )
  return failure('Bible Strong could not answer this request. Try again in a moment.')
}

export const createStudyServer = ({ api, links, cardHtml, cardDomain }: StudyServerOptions) => {
  const server = new McpServer(
    {
      name: 'bible-strong',
      title: 'Bible Strong',
      version: '1.0.0',
      websiteUrl: links.home('en'),
    },
    { instructions: INSTRUCTIONS }
  )

  const register = (capability: Capability, tool: Capability['read'], card?: CardKind) => {
    const uri = card ? cardUri(card) : undefined
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: z.object(capability.input),
        outputSchema: capability.output,
        annotations: READ_ONLY,
        _meta: {
          'openai/toolInvocation/invoking': tool.running,
          'openai/toolInvocation/invoked': tool.done,
          // The card of a tool, under the name of the standard and under the one older
          // hosts read.
          ...(uri ? { ui: { resourceUri: uri }, 'ui/resourceUri': uri } : {}),
        },
      },
      async (input, request) => {
        const meta = request.mcpReq._meta as Record<string, unknown> | undefined
        const context: StudyContext = {
          api,
          links,
          language: studyLanguageOf(meta?.['openai/locale'] ?? meta?.['webplus/i18n']),
        }
        try {
          const result = await capability.load(context, input)
          return {
            content: [{ type: 'text' as const, text: result.text }],
            structuredContent: result.model,
            // Beside the result and out of what the model reads: what the card draws.
            ...(result.card ? { _meta: { [CARD_META_KEY]: result.card } } : {}),
          }
        } catch (cause) {
          return explain(cause)
        }
      }
    )
  }

  for (const capability of CAPABILITIES) {
    register(capability, capability.read)
    const { show } = capability
    if (!show) continue
    register(capability, show, show.card)

    const uri = cardUri(show.card)
    const frame = {
      ui: {
        prefersBorder: true,
        ...(cardDomain ? { domain: cardDomain } : {}),
        // A card asks the network for nothing but the pictures it shows.
        csp: { connectDomains: [], resourceDomains: show.pictures ?? [] },
      },
      'openai/widgetDescription': show.cardSummary,
      // A card starts in the conversation. Named with both modes and no preference, ChatGPT
      // opens it on the whole screen at once; the person opens it wider when they wish.
      'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
    }
    server.registerResource(
      `card-${show.card.replaceAll('_', '-')}`,
      uri,
      { title: show.title, description: show.cardSummary, mimeType: CARD_MIME_TYPE, _meta: frame },
      async () => ({
        contents: [{ uri, mimeType: CARD_MIME_TYPE, text: cardHtml, _meta: frame }],
      })
    )
  }

  return server
}
