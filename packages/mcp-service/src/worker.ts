import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server'
import cardHtml from '../dist/widget.html'
import workbenchHtml from '../dist/workbench.html'
import { createSiteLinks } from './links'
import { createResourceReader } from './resourceApi'
import { createStudyServer } from './server'

const MCP_PATH = '/mcp'
const CHALLENGE_PATH = '/.well-known/openai-apps-challenge'
const READER_ADDRESS_HEADER = 'cf-connecting-ip'

// A client in a browser, such as an inspector, asks from another origin. The server holds
// nothing private: every origin may read it.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
  'access-control-allow-headers':
    'content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-expose-headers': 'mcp-session-id',
  'access-control-max-age': '86400',
}

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

const html = (body: string) =>
  new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })

type Asked = { method?: string; params?: { name?: string; uri?: string; arguments?: unknown } }

// On a development machine, what a host asks for is named in the terminal: the method,
// the tool or the card, and what the tool was handed. Nothing of it is written elsewhere.
const trace = async (request: Pick<Request, 'method' | 'json'>): Promise<void> => {
  if (request.method !== 'POST') return
  const body: unknown = await request.json().catch(() => undefined)
  for (const { method, params } of (Array.isArray(body) ? body : [body]) as Asked[]) {
    if (!method) continue
    const handed = params?.arguments === undefined ? '' : JSON.stringify(params.arguments)
    console.log(['→', method, params?.name ?? params?.uri, handed].filter(Boolean).join(' '))
  }
}

let handler: McpHttpHandler | undefined

// One server is built for each request, from the same definition: nothing is kept between
// two requests, and each asks the Resource API for the reader it answers.
const handlerFor = (env: Env): McpHttpHandler =>
  (handler ??= createMcpHandler(
    ({ requestInfo }) =>
      createStudyServer({
        api: createResourceReader({
          binding: env.RESOURCE_API,
          readerAddress: requestInfo?.headers.get(READER_ADDRESS_HEADER) ?? undefined,
        }),
        links: createSiteLinks(env.SITE_ORIGIN),
        cardHtml,
        cardDomain: env.CARD_DOMAIN || undefined,
      }),
    {
      // Tools answer at once: a single JSON body, never a stream to keep open.
      responseMode: 'json',
      onerror: error => console.error(JSON.stringify({ message: 'mcp error', error: error.message })),
    }
  ))

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === MCP_PATH) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
      if (env.CALL_TRACE === 'true') await trace(request.clone())
      return withCors(await handlerFor(env).fetch(request))
    }

    // What OpenAI reads to check who owns this host: the token, and nothing else.
    if (pathname === CHALLENGE_PATH) {
      return env.OPENAI_APPS_CHALLENGE ? text(env.OPENAI_APPS_CHALLENGE) : text('Not found', 404)
    }

    if (env.CARD_WORKBENCH === 'true' && pathname === '/workbench') return html(workbenchHtml)

    if (pathname === '/') {
      return text(
        'Bible Strong — MCP server.\n' +
          `Connect a client to ${new URL(MCP_PATH, request.url).href}\n` +
          `${env.SITE_ORIGIN}\n`
      )
    }

    // Among others, the addresses a client looks for a sign-in at: there is none.
    return text('Not found', 404)
  },
} satisfies ExportedHandler<Env>
