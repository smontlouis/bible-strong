// What the card knows of where it is shown, and what it may ask of its host.
import { CARD_META_KEY, type Card } from '../../src/cards/types'
import { createBridge, type DisplayMode, type HostContext, type ToolResult } from './bridge'
import type { Target } from './targets'

export type View =
  | { status: 'waiting' }
  /** Words instead of a card: what went wrong, or the answer of a host that hands no card. */
  | { status: 'text'; message: string; failed: boolean }
  /** The cards opened one from another: the last one is shown, the others are behind it. */
  | { status: 'ready'; stack: Card[] }

export type HostState = {
  view: View
  mode: DisplayMode
  /** The host can give the card the whole screen. */
  fullscreen: boolean
  /** The card is asking for something. */
  busy: boolean
  /** The language of the host, for the words said when there is no card to give one. */
  locale: string
}

// ChatGPT also gives a card what it was called with outside the standard messages.
type OpenAiGlobals = {
  toolResponseMetadata?: Record<string, unknown> | null
  openExternal?: (options: { href: string }) => void
}

const openai = (): OpenAiGlobals | undefined =>
  (window as unknown as { openai?: OpenAiGlobals }).openai

const cardOf = (result: ToolResult | undefined): Card | undefined => {
  const card = result?._meta?.[CARD_META_KEY] as Card | undefined
  return card && typeof card === 'object' && typeof card.kind === 'string' ? card : undefined
}

const messageOf = (result: ToolResult): string =>
  result.content?.find(part => part.type === 'text')?.text ?? ''

export const createHost = () => {
  const bridge = createBridge()
  let state: HostState = {
    view: { status: 'waiting' },
    mode: 'inline',
    fullscreen: false,
    busy: false,
    locale: document.documentElement.lang || navigator.language || 'en',
  }
  const listeners = new Set<() => void>()

  const set = (patch: Partial<HostState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const applyContext = (context: HostContext) => {
    const root = document.documentElement
    if (context.theme) root.dataset.theme = context.theme
    for (const [name, value] of Object.entries(context.styles?.variables ?? {})) {
      if (value) root.style.setProperty(name, value)
    }
    const mode = context.displayMode ?? state.mode
    root.dataset.mode = mode
    set({
      mode,
      fullscreen: context.availableDisplayModes?.includes('fullscreen') ?? state.fullscreen,
      locale: context.locale ?? state.locale,
    })
  }

  const show = (result: ToolResult) => {
    const card = cardOf(result)
    if (card) set({ view: { status: 'ready', stack: [card] } })
    else if (result.isError || state.view.status === 'waiting') {
      set({ view: { status: 'text', message: messageOf(result), failed: Boolean(result.isError) } })
    }
  }

  bridge.onHostContext(applyContext)
  bridge.onToolResult(show)
  bridge.ready.then(() => applyContext(bridge.hostContext())).catch(() => undefined)

  // The same result, as ChatGPT gives it to a card that was drawn before it arrived.
  const fromGlobals = () => {
    const meta = openai()?.toolResponseMetadata
    if (meta && state.view.status === 'waiting') show({ _meta: meta })
  }
  window.addEventListener('openai:set_globals', fromGlobals)
  fromGlobals()

  // A card takes the height of its content; in fullscreen the host gives it its own.
  new ResizeObserver(() => {
    if (state.mode === 'inline') bridge.reportSize(Math.ceil(document.body.scrollHeight))
  }).observe(document.body)

  const stack = () => (state.view.status === 'ready' ? state.view.stack : [])

  const load = async (target: Target): Promise<Card | undefined> => {
    set({ busy: true })
    try {
      return cardOf(await bridge.callTool(target.tool, target.args))
    } catch {
      return undefined
    } finally {
      set({ busy: false })
    }
  }

  const enterFullscreen = async (): Promise<boolean> => {
    if (state.mode === 'fullscreen') return true
    if (!state.fullscreen) return false
    const mode = await bridge.requestDisplayMode('fullscreen').catch(() => state.mode)
    document.documentElement.dataset.mode = mode
    set({ mode })
    return mode === 'fullscreen'
  }

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    state: () => state,

    /**
     * Opens what a card points to. With the whole screen the card shows it itself, and can
     * come back; in the flow of a conversation it is asked there instead, as its own turn.
     */
    open: async (target: Target) => {
      if (state.busy) return
      if (!(await enterFullscreen())) {
        await bridge.sendMessage(target.prompt).catch(() => undefined)
        return
      }
      const card = await load(target)
      if (!card) return
      set({ view: { status: 'ready', stack: [...stack(), card] } })
      window.scrollTo({ top: 0 })
      // What the person now looks at, for the model to follow the conversation.
      bridge.updateModelContext(`The user is now viewing: ${card.title}`).catch(() => undefined)
    },

    /** Reads the following items of the list shown, in place. */
    more: async (target: Target, merge: (current: Card, next: Card) => Card) => {
      if (state.busy) return
      const next = await load(target)
      const cards = stack()
      const current = cards.at(-1)
      if (!next || !current) return
      set({ view: { status: 'ready', stack: [...cards.slice(0, -1), merge(current, next)] } })
    },

    back: () => {
      const cards = stack()
      if (cards.length > 1) set({ view: { status: 'ready', stack: cards.slice(0, -1) } })
    },

    expand: () => void enterFullscreen(),

    openLink: (url: string) => {
      bridge.openLink(url).catch(() => {
        const external = openai()?.openExternal
        if (external) external({ href: url })
        else window.open(url, '_blank', 'noopener')
      })
    },

    /** Tells the model what was picked in the card, without a turn of conversation. */
    note: (text: string) => {
      bridge.updateModelContext(text).catch(() => undefined)
    },
  }
}

export type Host = ReturnType<typeof createHost>
