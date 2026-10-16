// A stand-in for the host, to look at the cards outside ChatGPT: it frames the card exactly
// as a host does (a sandboxed frame and the MCP Apps messages), asks this server for real
// results, and lets the theme, the width and the display mode be changed. Development only.
import './styles.css'
import { presets, type Preset } from './presets'

type JsonRpcMessage = {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: any
  result?: any
  error?: unknown
}

type Tool = {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  _meta?: { ui?: { resourceUri?: string } }
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

document.body.innerHTML = `
  <aside class="panel">
    <h1>Cards</h1>
    <label>Tool<select id="tool"></select></label>
    <label>Example<select id="preset"></select></label>
    <label>Arguments<textarea id="args" rows="8" spellcheck="false"></textarea></label>
    <button id="run" class="run">Show the card</button>
    <div class="toggles">
      <label>Theme<select id="theme"><option>light</option><option>dark</option></select></label>
      <label>Width<select id="width">
        <option value="390">Phone 390</option>
        <option value="720" selected>Conversation 720</option>
        <option value="1100">Wide 1100</option>
      </select></label>
      <label>Host locale<select id="locale"><option>fr-FR</option><option>en-US</option></select></label>
      <label>Fullscreen<select id="fullscreen"><option value="yes">offered</option><option value="no">not offered</option></select></label>
    </div>
    <h2>Model sees</h2>
    <pre id="model"></pre>
    <h2>Messages</h2>
    <ol id="log"></ol>
  </aside>
  <main class="stage" id="stage">
    <div class="conversation" id="conversation">
      <p class="bubble">The card below is framed like in a conversation.</p>
      <div class="frame-holder" id="holder"></div>
      <p class="bubble muted">The answer of the model comes after the card.</p>
    </div>
  </main>
`

const toolSelect = $<HTMLSelectElement>('#tool')
const presetSelect = $<HTMLSelectElement>('#preset')
const argsInput = $<HTMLTextAreaElement>('#args')
const themeSelect = $<HTMLSelectElement>('#theme')
const widthSelect = $<HTMLSelectElement>('#width')
const localeSelect = $<HTMLSelectElement>('#locale')
const fullscreenSelect = $<HTMLSelectElement>('#fullscreen')
const holder = $<HTMLDivElement>('#holder')
const stage = $<HTMLElement>('#stage')
const conversation = $<HTMLDivElement>('#conversation')
const logList = $<HTMLOListElement>('#log')
const modelView = $<HTMLPreElement>('#model')

// --- The MCP server, asked over HTTP like any client ------------------------

let rpcId = 0

const mcp = async <T>(method: string, params: unknown): Promise<T> => {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const text = await response.text()
  // A streamed answer carries the message in its `data:` lines.
  const body = response.headers.get('content-type')?.includes('text/event-stream')
    ? text
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('')
    : text
  const message = JSON.parse(body) as JsonRpcMessage
  if (message.error) throw new Error(JSON.stringify(message.error))
  return message.result as T
}

const callTool = (name: string, args: unknown) =>
  mcp<any>('tools/call', {
    name,
    arguments: args,
    _meta: { 'openai/locale': localeSelect.value },
  })

// --- The frame and its messages -------------------------------------------

let frame: HTMLIFrameElement | undefined
let displayMode: 'inline' | 'fullscreen' = 'inline'
let current: { tool: Tool; args: Record<string, unknown>; result: unknown } | undefined

const log = (direction: '→' | '←', label: string, detail?: unknown) => {
  const item = document.createElement('li')
  item.textContent = `${direction} ${label}`
  if (detail !== undefined) {
    const more = document.createElement('code')
    more.textContent = JSON.stringify(detail).slice(0, 240)
    item.append(more)
  }
  logList.prepend(item)
}

const hostContext = () => ({
  theme: themeSelect.value,
  locale: localeSelect.value,
  displayMode,
  availableDisplayModes: fullscreenSelect.value === 'yes' ? ['inline', 'fullscreen'] : ['inline'],
  platform: Number(widthSelect.value) < 500 ? 'mobile' : 'web',
  containerDimensions:
    displayMode === 'fullscreen'
      ? { width: stage.clientWidth, height: stage.clientHeight }
      : { width: Number(widthSelect.value), maxHeight: 800 },
})

const send = (message: Omit<JsonRpcMessage, 'jsonrpc'>) => {
  frame?.contentWindow?.postMessage({ jsonrpc: '2.0', ...message }, '*')
}

// `?bare` leaves the card alone on the page, at the width of the window: the way to look at
// it in a narrow window. `&theme=dark` and `&locale=en-US` set what the panel would.
const query = new URLSearchParams(location.search)
const bare = query.has('bare')
document.body.classList.toggle('bare', bare)
if (query.get('theme')) themeSelect.value = query.get('theme')!
if (query.get('locale')) localeSelect.value = query.get('locale')!
if (query.get('fullscreen')) fullscreenSelect.value = query.get('fullscreen')!

const applyLayout = () => {
  document.documentElement.dataset.theme = themeSelect.value
  stage.dataset.mode = displayMode
  conversation.style.width =
    displayMode === 'fullscreen' || bare ? '100%' : `${widthSelect.value}px`
  if (frame && displayMode === 'fullscreen') frame.style.height = '100%'
}

const pushContext = () => {
  applyLayout()
  send({ method: 'ui/notifications/host-context-changed', params: hostContext() })
}

window.addEventListener('message', async event => {
  if (!frame || event.source !== frame.contentWindow) return
  const message = event.data as JsonRpcMessage
  if (!message || message.jsonrpc !== '2.0' || !message.method) return
  const reply = (result: unknown) => send({ id: message.id, result })

  switch (message.method) {
    case 'ui/initialize':
      log('←', 'ui/initialize')
      reply({
        protocolVersion: '2026-01-26',
        hostInfo: { name: 'bible-strong-workbench', version: '1.0.0' },
        hostCapabilities: {
          openLinks: {},
          serverTools: {},
          message: { text: {} },
          updateModelContext: { text: {} },
        },
        hostContext: hostContext(),
      })
      break
    case 'ui/notifications/initialized':
      if (!current) break
      send({ method: 'ui/notifications/tool-input', params: { arguments: current.args } })
      send({ method: 'ui/notifications/tool-result', params: current.result })
      log('→', 'tool-input, tool-result')
      break
    case 'ui/notifications/size-changed':
      if (displayMode === 'inline' && typeof message.params?.height === 'number') {
        frame.style.height = `${Math.ceil(message.params.height)}px`
      }
      break
    case 'tools/call':
      log('←', `tools/call ${message.params?.name}`, message.params?.arguments)
      try {
        reply(await callTool(message.params.name, message.params.arguments))
      } catch (cause) {
        send({ id: message.id, error: { code: -32000, message: String(cause) } })
      }
      break
    case 'ui/open-link':
      log('←', 'ui/open-link', message.params?.url)
      window.open(message.params.url, '_blank', 'noopener')
      reply({})
      break
    case 'ui/message':
      log('←', 'ui/message', message.params?.content?.[0]?.text)
      reply({})
      break
    case 'ui/update-model-context':
      log('←', 'ui/update-model-context', message.params)
      reply({})
      break
    case 'ui/request-display-mode': {
      const wanted = message.params?.mode
      const offered = hostContext().availableDisplayModes.includes(wanted)
      if (offered) displayMode = wanted
      log('←', `ui/request-display-mode ${wanted}`, { granted: offered })
      reply({ mode: displayMode })
      pushContext()
      break
    }
    default:
      log('←', message.method)
      if (message.id !== undefined) reply({})
  }
})

const show = async () => {
  const tool = tools.find(candidate => candidate.name === toolSelect.value)
  if (!tool) return
  let args: Record<string, unknown>
  try {
    args = JSON.parse(argsInput.value || '{}')
  } catch {
    modelView.textContent = 'The arguments are not valid JSON.'
    return
  }
  logList.replaceChildren()
  displayMode = 'inline'
  const result = await callTool(tool.name, args).catch(cause => ({
    isError: true,
    content: [{ type: 'text', text: String(cause) }],
  }))
  current = { tool, args, result }
  modelView.textContent = JSON.stringify(
    { content: result.content, structuredContent: result.structuredContent },
    null,
    2
  )

  const uri = tool._meta?.ui?.resourceUri
  holder.replaceChildren()
  frame = undefined
  if (!uri) return
  const resource = await mcp<any>('resources/read', { uri })
  frame = document.createElement('iframe')
  // What a host allows a card: scripts, and nothing of the page that frames it.
  frame.sandbox.add('allow-scripts')
  frame.title = tool.title ?? tool.name
  frame.srcdoc = resource.contents[0].text
  holder.append(frame)
  applyLayout()
}

// --- The panel -------------------------------------------------------------

let tools: Tool[] = []

const presetsOf = (toolName: string): Preset[] =>
  presets.filter(preset => preset.tool === toolName)

const fillPresets = () => {
  const available = presetsOf(toolSelect.value)
  presetSelect.replaceChildren(
    ...available.map((preset, index) => new Option(preset.label, String(index)))
  )
  argsInput.value = JSON.stringify(available[0]?.args ?? {}, null, 2)
}

toolSelect.addEventListener('change', () => {
  fillPresets()
  void show()
})
presetSelect.addEventListener('change', () => {
  const preset = presetsOf(toolSelect.value)[Number(presetSelect.value)]
  argsInput.value = JSON.stringify(preset?.args ?? {}, null, 2)
  void show()
})
$('#run').addEventListener('click', () => void show())
for (const control of [themeSelect, widthSelect, fullscreenSelect]) {
  control.addEventListener('change', pushContext)
}
localeSelect.addEventListener('change', () => void show())

const start = async () => {
  const listed = await mcp<{ tools: Tool[] }>('tools/list', {})
  tools = listed.tools
  const withCard = tools.filter(tool => tool._meta?.ui?.resourceUri)
  const withoutCard = tools.filter(tool => !tool._meta?.ui?.resourceUri)
  const group = (label: string, members: Tool[]) => {
    const element = document.createElement('optgroup')
    element.label = label
    element.append(...members.map(tool => new Option(tool.title ?? tool.name, tool.name)))
    return element
  }
  toolSelect.replaceChildren(group('With a card', withCard), group('Data only', withoutCard))
  // A link to one card and one of its examples: `/workbench#show_passage/2`.
  const [asked = '', example = '0'] = location.hash.slice(1).split('/')
  if (tools.some(tool => tool.name === asked)) toolSelect.value = asked
  fillPresets()
  const preset = presetsOf(toolSelect.value)[Number(example)]
  if (preset) {
    presetSelect.value = example
    argsInput.value = JSON.stringify(preset.args, null, 2)
  }
  applyLayout()
  await show()
}

void start()
