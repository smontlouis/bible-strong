// The few shapes every card is made of.
import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useContext, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Block, Inline, MarkedPart, VerseHit } from '../../src/cards/types'
import type { Host, HostState } from './host'
import type { Messages } from './i18n'
import type { Target, Targets } from './targets'

/** What a card is given to draw itself and to ask for more. */
export type CardContext = {
  host: Host
  state: HostState
  t: Messages
  go: Targets
  /** Whether another card is behind this one. */
  canGoBack: boolean
}

export const Context = createContext<CardContext>(undefined as unknown as CardContext)
export const useCard = () => useContext(Context)

// --- Icons: outline, in the colour of the text beside them -------------------------

const Icon = ({ path }: { path: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
)

export const BackIcon = () => <Icon path="M15 18l-6-6 6-6" />
export const ExpandIcon = () => <Icon path="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
export const ExternalIcon = () => <Icon path="M7 17L17 7M8 7h9v9" />

// --- The frame of a card -----------------------------------------------------------

export type Universe = 'bible' | 'strong' | 'dictionary' | 'nave' | 'commentary' | 'references'

export const Frame = ({
  universe,
  eyebrow,
  title,
  subtitle,
  children,
  actions,
  lang,
}: {
  universe: Universe
  eyebrow: string
  title: ComponentChildren
  subtitle?: ComponentChildren
  children: ComponentChildren
  actions?: ComponentChildren
  lang: string
}) => {
  const { host, state, t, canGoBack } = useCard()
  return (
    <article class={`card${state.busy ? ' busy' : ''}`} lang={lang} aria-busy={state.busy}>
      <header class="head">
        {canGoBack && (
          <button type="button" class="icon-button" onClick={host.back} aria-label={t.back}>
            <BackIcon />
          </button>
        )}
        <div class="head-text">
          <p class="eyebrow" style={{ '--universe': `var(--universe-${universe})` }}>
            <span class="dot" />
            {eyebrow}
          </p>
          <h2 class="title">{title}</h2>
          {subtitle ? <p class="subtitle">{subtitle}</p> : null}
        </div>
        {state.mode === 'inline' && state.fullscreen && (
          <button type="button" class="icon-button" onClick={host.expand} aria-label={t.expand}>
            <ExpandIcon />
          </button>
        )}
      </header>
      {children}
      {actions ? <footer class="actions">{actions}</footer> : null}
    </article>
  )
}

export const Button = ({
  kind = 'secondary',
  onClick,
  children,
  disabled,
}: {
  kind?: 'primary' | 'secondary' | 'quiet'
  onClick: () => void
  children: ComponentChildren
  disabled?: boolean
}) => (
  <button type="button" class={`button button-${kind}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
)

/** The link every card ends with: the page of what it shows, on bible-strong.app. */
export const SiteLink = ({ url }: { url: string | undefined }) => {
  const { host, t } = useCard()
  if (!url) return null
  return (
    <Button onClick={() => host.openLink(url)}>
      {t.openInBibleStrong}
      <ExternalIcon />
    </Button>
  )
}

export const Open = ({ target, children, kind }: { target: Target; children: ComponentChildren; kind?: 'primary' | 'secondary' | 'quiet' }) => {
  const { host, state } = useCard()
  return (
    <Button kind={kind} onClick={() => void host.open(target)} disabled={state.busy}>
      {children}
    </Button>
  )
}

/** A small link to what is beside the main subject of a card. */
export const ChipLink = ({ target, children }: { target: Target; children: ComponentChildren }) => {
  const { host, state } = useCard()
  return (
    <button type="button" class="chip" onClick={() => void host.open(target)} disabled={state.busy}>
      {children}
    </button>
  )
}

export const Section = ({ title, children }: { title: string; children: ComponentChildren }) => (
  <section>
    <h3 class="section-title">{title}</h3>
    {children}
  </section>
)

// --- Text ----------------------------------------------------------------------

/**
 * Long text is cut in the flow of a conversation, where a card may not scroll, and opens in
 * full when the card is given the whole screen.
 */
export const Clamp = ({ height = 240, children }: { height?: number; children: ComponentChildren }) => {
  const { host, state, t } = useCard()
  const box = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const inline = state.mode === 'inline'

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setOverflows(element.scrollHeight > height + 24)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [height, children])

  const cut = inline && overflows
  return (
    <div>
      <div ref={box} class={cut ? 'clamped' : undefined} style={cut ? { '--clamp': `${height}px` } : undefined}>
        {children}
      </div>
      {cut && state.fullscreen && (
        <Button kind="quiet" onClick={host.expand}>
          {t.readMore}
        </Button>
      )}
    </div>
  )
}

export const Marked = ({ parts }: { parts: readonly MarkedPart[] }) => (
  <>{parts.map(part => (part.hit ? <mark>{part.text}</mark> : part.text))}</>
)

const InlineNodes = ({ nodes }: { nodes: readonly Inline[] }) => {
  const { host, go, state } = useCard()
  const link = (target: Target, text: string) => (
    <button type="button" class="link" onClick={() => void host.open(target)} disabled={state.busy}>
      {text}
    </button>
  )
  return (
    <>
      {nodes.map(node => {
        switch (node.t) {
          case 'br':
            return <br />
          case 'ref':
            return link(go.passage(node.osis, node.label ?? node.text), node.text)
          case 'strong':
            return link(go.strong(node.code), node.text)
          case 'topic':
            return link(go.topic(node.name, node.text), node.text)
          case 'entry':
            return link(go.dictionary(node.work, node.id, node.text), node.text)
          default: {
            let content: ComponentChildren = node.text
            if (node.sup) content = <sup>{content}</sup>
            if (node.i) content = <em>{content}</em>
            if (node.b) content = <strong>{content}</strong>
            return content
          }
        }
      })}
    </>
  )
}

const Blocks = ({ blocks }: { blocks: readonly Block[] }) => (
  <>
    {blocks.map(block => {
      if (block.t === 'rule') return <hr class="divider" />
      if (block.t === 'list') {
        const List = block.ordered ? 'ol' : 'ul'
        return (
          <List>
            {block.items.map(item => (
              <li>
                <Blocks blocks={item} />
              </li>
            ))}
          </List>
        )
      }
      const Tag = block.t === 'h' ? 'h4' : block.t === 'quote' ? 'blockquote' : 'p'
      return (
        <Tag>
          <InlineNodes nodes={block.c} />
        </Tag>
      )
    })}
  </>
)

/** The text of an article, a definition or a comment. */
export const RichText = ({ blocks }: { blocks: readonly Block[] }) => (
  <div class="prose">
    <Blocks blocks={blocks} />
  </div>
)

// --- Lists of verses ---------------------------------------------------------------

export const VerseRows = ({
  items,
  open,
}: {
  items: readonly VerseHit[]
  open: (item: VerseHit) => Target
}) => {
  const { host, state } = useCard()
  return (
    <ul class="list">
      {items.map(item => (
        <li>
          <button
            type="button"
            class="row"
            onClick={() => void host.open(open(item))}
            disabled={state.busy}
          >
            <span class="row-line">
              <span class="row-title">{item.label}</span>
              {item.note ? <span class="chip chip-neutral">{item.note}</span> : null}
            </span>
            <span class="row-text">
              <Marked parts={item.parts} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Shows the first items of a long list, and the others on request, without leaving. */
export const Reveal = <Item,>({
  items,
  first,
  render,
}: {
  items: readonly Item[]
  first: number
  render: (shown: readonly Item[]) => ComponentChildren
}) => {
  const { state, t } = useCard()
  const [all, setAll] = useState(false)
  const everything = all || state.mode === 'fullscreen' || items.length <= first
  return (
    <>
      {render(everything ? items : items.slice(0, first))}
      {!everything && (
        <div>
          <Button kind="quiet" onClick={() => setAll(true)}>
            {t.showMore}
          </Button>
        </div>
      )}
    </>
  )
}
