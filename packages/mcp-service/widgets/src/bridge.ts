// The card's side of MCP Apps: JSON-RPC over `postMessage` with the host that frames it
// (specification 2026-01-26). Written against the standard so that the same card runs in
// every host that implements it; nothing here is specific to one of them.

export type DisplayMode = 'inline' | 'fullscreen' | 'pip'

export type HostContext = {
  theme?: 'light' | 'dark'
  locale?: string
  displayMode?: DisplayMode
  availableDisplayModes?: DisplayMode[]
  platform?: 'web' | 'desktop' | 'mobile'
  containerDimensions?: { height?: number; maxHeight?: number; width?: number; maxWidth?: number }
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number }
  styles?: { variables?: Record<string, string | undefined> }
}

export type HostCapabilities = {
  openLinks?: object
  serverTools?: object
  message?: object
  updateModelContext?: object
}

export type ToolResult = {
  structuredContent?: unknown
  content?: { type: string; text?: string }[]
  isError?: boolean
  _meta?: Record<string, unknown>
}

type Pending = { resolve: (value: unknown) => void; reject: (reason: unknown) => void }

type Listener<T> = (value: T) => void

const PROTOCOL_VERSION = '2026-01-26'
const REQUEST_TIMEOUT_MS = 30_000

export type Bridge = {
  /** Resolves once the host has answered `ui/initialize`; rejects when no host answers. */
  ready: Promise<void>
  hostContext: () => HostContext
  capabilities: () => HostCapabilities
  onToolInput: (listener: Listener<Record<string, unknown>>) => void
  onToolResult: (listener: Listener<ToolResult>) => void
  onHostContext: (listener: Listener<HostContext>) => void
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  openLink: (url: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  requestDisplayMode: (mode: DisplayMode) => Promise<DisplayMode>
  updateModelContext: (text: string) => Promise<void>
  reportSize: (height: number) => void
}

export const createBridge = (
  host: Window = window.parent,
  displayModes: DisplayMode[] = ['inline', 'fullscreen']
): Bridge => {
  let nextId = 0
  const pending = new Map<number, Pending>()
  let context: HostContext = {}
  let hostCapabilities: HostCapabilities = {}
  const toolInputListeners: Listener<Record<string, unknown>>[] = []
  const toolResultListeners: Listener<ToolResult>[] = []
  const contextListeners: Listener<HostContext>[] = []
  // A host may send the result before the card has subscribed: the last one is replayed.
  let lastInput: Record<string, unknown> | undefined
  let lastResult: ToolResult | undefined

  const notify = (method: string, params: unknown = {}) => {
    host.postMessage({ jsonrpc: '2.0', method, params }, '*')
  }

  const request = <T>(method: string, params: unknown): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${method} timed out`))
      }, REQUEST_TIMEOUT_MS)
      pending.set(id, {
        resolve: value => {
          clearTimeout(timer)
          resolve(value as T)
        },
        reject: reason => {
          clearTimeout(timer)
          reject(reason)
        },
      })
      host.postMessage({ jsonrpc: '2.0', id, method, params }, '*')
    })

  window.addEventListener('message', event => {
    if (event.source !== host) return
    const message = event.data
    if (!message || message.jsonrpc !== '2.0') return

    // An answer to a request of the card.
    if (message.id !== undefined && message.method === undefined) {
      const waiting = pending.get(message.id)
      if (!waiting) return
      pending.delete(message.id)
      if (message.error) waiting.reject(message.error)
      else waiting.resolve(message.result)
      return
    }

    switch (message.method) {
      case 'ui/notifications/tool-input':
        lastInput = message.params?.arguments ?? {}
        for (const listener of toolInputListeners) listener(lastInput!)
        break
      case 'ui/notifications/tool-result':
        lastResult = (message.params ?? {}) as ToolResult
        for (const listener of toolResultListeners) listener(lastResult)
        break
      case 'ui/notifications/host-context-changed':
        context = { ...context, ...(message.params ?? {}) }
        for (const listener of contextListeners) listener(context)
        break
      case 'ui/resource-teardown':
        // Nothing to save: the card holds no state of its own.
        if (message.id !== undefined) {
          host.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*')
        }
        break
      case 'ping':
        if (message.id !== undefined) {
          host.postMessage({ jsonrpc: '2.0', id: message.id, result: {} }, '*')
        }
        break
    }
  })

  const ready = request<{ hostContext?: HostContext; hostCapabilities?: HostCapabilities }>(
    'ui/initialize',
    {
      appInfo: { name: 'bible-strong-cards', version: '1.0.0' },
      appCapabilities: { availableDisplayModes: displayModes },
      protocolVersion: PROTOCOL_VERSION,
    }
  ).then(result => {
    context = result?.hostContext ?? {}
    hostCapabilities = result?.hostCapabilities ?? {}
    notify('ui/notifications/initialized')
    for (const listener of contextListeners) listener(context)
  })

  return {
    ready,
    hostContext: () => context,
    capabilities: () => hostCapabilities,
    onToolInput: listener => {
      toolInputListeners.push(listener)
      if (lastInput) listener(lastInput)
    },
    onToolResult: listener => {
      toolResultListeners.push(listener)
      if (lastResult) listener(lastResult)
    },
    onHostContext: listener => {
      contextListeners.push(listener)
    },
    callTool: (name, args) => request<ToolResult>('tools/call', { name, arguments: args }),
    openLink: async url => {
      const result = await request<{ isError?: boolean }>('ui/open-link', { url })
      if (result?.isError) throw new Error('The host did not open the link')
    },
    sendMessage: async text => {
      await request('ui/message', { role: 'user', content: [{ type: 'text', text }] })
    },
    requestDisplayMode: async mode => {
      const result = await request<{ mode?: DisplayMode }>('ui/request-display-mode', { mode })
      return result?.mode ?? mode
    },
    updateModelContext: async text => {
      await request('ui/update-model-context', { content: [{ type: 'text', text }] })
    },
    reportSize: height => notify('ui/notifications/size-changed', { height }),
  }
}
