import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { ChevronRightIcon, ClockIcon, MapPinIcon, UserRoundIcon } from 'lucide-react'
import ResourceIconDOM from '~common/icons/ResourceIconDOM'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveUniverseColors } from '~themes/universeColors'
import './widgets.css'

export type QuoteMark =
  | ComponentProps<typeof ResourceIconDOM>['kind']
  | 'person'
  | 'place'
  | 'timeline'
  | 'bible'

// A control inside the quote handles its own click; the quote opens only on the rest of it.
const INNER_CONTROL = 'a, button, input, select, summary, [role="button"], [role="link"]'

/** Opens the quote from a click on its text, unless the reader was selecting words. */
const openFromQuote = (event: MouseEvent<HTMLElement>, open: () => void) => {
  const control = (event.target as HTMLElement).closest(INNER_CONTROL)
  if (control && event.currentTarget.contains(control)) return
  const selection = window.getSelection()
  if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode))
    return
  open()
}

function MarkIcon({ mark }: { mark: QuoteMark }) {
  if (mark === 'bible') return null
  if (mark === 'person') return <UserRoundIcon size={13} aria-hidden="true" />
  if (mark === 'place') return <MapPinIcon size={13} aria-hidden="true" />
  if (mark === 'timeline') return <ClockIcon size={13} aria-hidden="true" />
  return <ResourceIconDOM kind={mark} size={14} />
}

/**
 * A resource quoted in the flow of an answer, as on the phone (2026-11-08): no frame and no
 * tinted bubble, a rule in the resource's colour, a preview, then a foot line with its mark and
 * name. A click on the quote opens the resource; the name is the button a keyboard reaches, so
 * the words stay selectable and no control sits inside another.
 */
export function QuoteBlock({
  mark,
  foot,
  onPress,
  aside,
  children,
}: {
  mark: QuoteMark
  foot: string
  onPress?: () => void
  /** A control after the name in the foot line, such as « Afficher la suite ». */
  aside?: ReactNode
  children: ReactNode
}) {
  const { colors, fontFamily } = useTheme()
  const rule =
    mark === 'bible'
      ? colors.primary
      : resolveUniverseColors(colors, mark === 'person' || mark === 'place' ? 'word' : mark)
          .foreground
  const style = {
    fontFamily: resolveFontFamily(fontFamily.text),
    '--q-ink': colors.default,
    '--q-muted': colors.grey,
    '--q-link': colors.link,
    '--q-rule': rule,
  } as CSSProperties
  return (
    <div
      className="bs-quote"
      data-opens={onPress ? 'true' : undefined}
      style={style}
      onClick={onPress ? event => openFromQuote(event, onPress) : undefined}
    >
      <div className="bs-quote-body">
        {children}
        <div className="bs-quote-foot">
          <MarkIcon mark={mark} />
          {onPress ? (
            <button type="button" className="bs-quote-name" onClick={onPress}>
              {foot}
            </button>
          ) : (
            <span className="bs-quote-name">{foot}</span>
          )}
          {aside}
        </div>
      </div>
      {onPress && <ChevronRightIcon className="bs-quote-chevron" size={16} aria-hidden="true" />}
    </div>
  )
}

/** A preview cut at `maxHeight`, faded out only when its content is taller. */
export function QuoteCut({ maxHeight, children }: { maxHeight: number; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)
  useLayoutEffect(() => {
    const node = content.current
    if (!node) return
    // The preview may load after the first paint, so its height is followed, not read once.
    const measure = () => setTall(node.offsetHeight > maxHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [maxHeight])
  return (
    <div className="bs-quote-cut" data-tall={tall ? 'true' : undefined} style={{ maxHeight }}>
      <div ref={content}>{children}</div>
    </div>
  )
}

/** The rest of a list, shown on demand. */
export function QuoteMore({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <button
      type="button"
      className="bs-quote-more"
      style={{ '--q-link': colors.link } as CSSProperties}
      onClick={onPress}
    >
      {label}
    </button>
  )
}

/** The placeholder of a quote whose content is loading. */
export function QuoteLoading({ label }: { label: string }) {
  return (
    <div className="bs-quote-loading" role="status" aria-label={label}>
      <span />
      <span />
    </div>
  )
}
