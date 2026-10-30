import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildStrongPath, displayStrongCode, parseStrongCode } from '../strong/strongRoutes'
import {
  adjust,
  CardBack,
  cardClasses,
  CardFront,
  clamp,
  drawTextures,
  paint,
  REST,
  restingSprings,
  step,
  type Springs,
} from './AtlasCards'
import { CARD_FAMILY_LABELS, type AtlasGalleryCard } from './atlasCardCatalog'
import { buildAtlasCardPath, buildAtlasEntityPath } from './atlasRoutes'

// A card opened over the gallery, at its own address: it rises from its place in the grid, tilts
// under the pointer, turns over when touched, and gives way to the card before or after it with a
// swipe or the arrow keys. Beside it, where it leads: its character, its Strong number, its verses.

export const VIEWER_WORDS = {
  fr: {
    previous: 'Carte précédente',
    next: 'Carte suivante',
    flip: 'Retourner',
    front: 'Recto',
    close: 'Fermer',
    page: 'La page de {name}',
    first: 'Première mention',
    sentence: 'La phrase de la carte',
    strong: 'Numéro Strong',
    series: 'Toute la série',
    share: 'Partager',
    copied: 'Lien copié',
    rank: 'Carte {rank} sur {total} de {name}',
    stage: 'Étape de vie',
    position: '{position} sur {count}',
  },
  en: {
    previous: 'Previous card',
    next: 'Next card',
    flip: 'Turn over',
    front: 'Front',
    close: 'Close',
    page: 'The page of {name}',
    first: 'First mention',
    sentence: 'The sentence of the card',
    strong: 'Strong’s number',
    series: 'The whole series',
    share: 'Share',
    copied: 'Link copied',
    rank: 'Card {rank} of {total} of {name}',
    stage: 'Life stage',
    position: '{position} of {count}',
  },
} as const

/** The Bible page of a reference of the entity publication, `Gen.25.26`. */
const versePath = (language: ResourceLanguage, reference: string | undefined) => {
  const [book, chapter, verse] = reference?.split('.') ?? []
  const index = (TIPNR_BOOK_CODES as readonly string[]).indexOf(book ?? '')
  if (index < 0 || !chapter) return undefined
  return buildBibleReferencePath(language, {
    book: index + 1,
    chapter: Number(chapter),
    ...(verse ? { verse: Number(verse) } : {}),
  })
}

/** Where a card rises from: the place of its copy in the grid, when it is on screen. */
export type CardOrigin = { x: number; y: number; width: number }

const SWIPE = 56

// The card is placed where it rises from before the browser paints it.
const useArrivalEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export default function AtlasCardViewer({
  card,
  cards,
  siblings,
  language,
  origin,
  onClose,
  onMove,
  onSeries,
}: {
  card: AtlasGalleryCard
  /** The cards the viewer moves through: the gallery as it is filtered and ordered. */
  cards: AtlasGalleryCard[]
  /** Every card of the same character, base card first. */
  siblings: AtlasGalleryCard[]
  language: ResourceLanguage
  origin?: CardOrigin
  onClose: () => void
  onMove: (card: AtlasGalleryCard, direction: -1 | 1) => void
  onSeries?: (series: string) => void
}) {
  const words = VIEWER_WORDS[language]
  const element = useRef<HTMLDivElement>(null)
  const rotator = useRef<HTMLButtonElement>(null)
  const springs = useRef<Springs>(restingSprings())
  const frame = useRef(0)
  const still = useRef(false)
  const endTimer = useRef(0)
  const down = useRef<{ x: number; y: number; id: number }>(undefined)
  const swiped = useRef(false)
  const [flipped, setFlipped] = useState(false)
  const [copied, setCopied] = useState(false)
  const arrival = useRef<{ origin?: CardOrigin; direction: -1 | 0 | 1 }>({ origin, direction: 0 })

  const position = cards.findIndex(item => item.id === card.id)
  const previous = position > 0 ? cards[position - 1] : undefined
  const next = position >= 0 && position < cards.length - 1 ? cards[position + 1] : undefined

  const tick = () => {
    let moving = false
    const s = springs.current
    for (const value of Object.values(s)) if (step(value, still.current)) moving = true
    if (s.spin.t === 360 && Math.abs(s.spin.x - 360) < 0.5) {
      s.spin.x = 0
      s.spin.t = 0
      s.spin.v = 0
    }
    if (element.current) paint(element.current, s)
    frame.current = moving ? requestAnimationFrame(tick) : 0
  }
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick)
  }

  const rest = (delay = 400) => {
    window.clearTimeout(endTimer.current)
    endTimer.current = window.setTimeout(() => {
      const s = springs.current
      element.current?.classList.remove('is-interacting')
      s.rx.t = 0
      s.ry.t = 0
      s.gx.t = REST.x
      s.gy.t = REST.y
      s.go.t = REST.shine
      s.gl.t = 0
      s.bx.t = adjust(REST.x, 0, 100, 37, 63)
      s.by.t = adjust(REST.y, 0, 100, 33, 67)
      kick()
    }, delay)
  }

  const tilt = (clientX: number, clientY: number) => {
    const rect = rotator.current?.getBoundingClientRect()
    if (!rect) return
    const px = clamp(((clientX - rect.left) / rect.width) * 100)
    const py = clamp(((clientY - rect.top) / rect.height) * 100)
    window.clearTimeout(endTimer.current)
    element.current?.classList.add('is-interacting')
    const s = springs.current
    s.bx.t = adjust(px, 0, 100, 37, 63)
    s.by.t = adjust(py, 0, 100, 33, 67)
    s.rx.t = -((px - 50) / 3.5)
    s.ry.t = (py - 50) / 3.5
    s.gx.t = px
    s.gy.t = py
    s.go.t = 1
    s.gl.t = 1
    kick()
  }

  const flip = () => {
    const s = springs.current
    s.flip.t = s.flip.t ? 0 : 180
    setFlipped(Boolean(s.flip.t))
    kick()
  }

  // A new card arrives: from its place in the grid the first time, from the side after a swipe.
  useArrivalEffect(() => {
    drawTextures()
    still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s = (springs.current = restingSprings())
    setFlipped(false)
    const target = element.current?.getBoundingClientRect()
    const { origin: from, direction } = arrival.current
    if (target && !still.current) {
      if (from) {
        s.tx.x = from.x - (target.left + target.width / 2)
        s.ty.x = from.y - (target.top + target.height / 2)
        s.sc.x = from.width / target.width
        s.spin.t = 360
      } else if (direction) {
        s.tx.x = direction * Math.min(target.width * 0.6, 220)
        s.sc.x = 0.92
      } else {
        s.sc.x = 0.9
      }
    }
    arrival.current = { direction: 0 }
    if (element.current) paint(element.current, s)
    kick()
    rest(s.spin.t ? 900 : 120)
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      window.clearTimeout(endTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  const move = (direction: -1 | 1) => {
    const target = direction < 0 ? previous : next
    if (!target) return
    arrival.current = { direction }
    onMove(target, direction)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') move(-1)
      else if (event.key === 'ArrowRight') move(1)
    }
    document.addEventListener('keydown', onKey)
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      root.style.overflow = overflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, previous?.id, next?.id])

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    down.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    swiped.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    tilt(event.clientX, event.clientY)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = down.current
    if (start && event.pointerType !== 'mouse') {
      const dx = event.clientX - start.x
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
        // A sideways drag carries the card along, then lets the next one in.
        springs.current.tx.t = dx * 0.6
        kick()
        if (Math.abs(dx) > SWIPE) swiped.current = true
        return
      }
    }
    if (event.pointerType === 'mouse' || start) tilt(event.clientX, event.clientY)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = down.current
    down.current = undefined
    springs.current.tx.t = 0
    if (start && swiped.current) {
      move(event.clientX - start.x < 0 ? 1 : -1)
      return
    }
    rest(250)
  }

  const share = async () => {
    const url = `${window.location.origin}${buildAtlasCardPath(language, card.id)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${card.name} – ${card.title}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // The reader closed the sheet, or the clipboard is not reachable: nothing to say.
    }
  }

  const rank = siblings.findIndex(item => item.id === card.id) + 1
  const firstPath = versePath(language, card.firstRef)
  const sentencePath = versePath(language, card.lineRef)
  const strongPath = parseStrongCode(card.strong)
    ? buildStrongPath(language, card.strong)
    : undefined
  const seriesId = card.seriesIds[0]

  return (
    <div className="acv" role="dialog" aria-modal="true" aria-label={`${card.name}, ${card.title}`}>
      <div className="acv__shade" onClick={onClose} aria-hidden="true" />
      <div className="acv__stage">
        <div className="acv__slot">
          <div ref={element} className={`${cardClasses(card)} acv__card is-active`}>
            <div className="ac-translater">
              <button
                ref={rotator}
                type="button"
                className="ac-rotator"
                aria-label={`${card.name}, ${card.title}. ${flipped ? words.front : words.flip}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  down.current = undefined
                  springs.current.tx.t = 0
                  rest(0)
                }}
                onPointerLeave={event => {
                  if (event.pointerType === 'mouse') rest()
                }}
                onClick={() => {
                  if (swiped.current) swiped.current = false
                  else flip()
                }}
              >
                <div className="ac-face ac-front">
                  <CardFront card={card} />
                </div>
                <div className="ac-face ac-back">
                  <CardBack
                    card={card}
                    language={language}
                    rank={rank || 1}
                    total={siblings.length || 1}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        <aside className="acv__panel">
          <p className="acv__eyebrow">
            {CARD_FAMILY_LABELS[card.family][language]} · {card.era}
          </p>
          <h2 className="acv__name">{card.name}</h2>
          <p className="acv__title">
            {card.title}
            {card.stage ? <span className="acv__stage-mark">{words.stage}</span> : null}
          </p>
          {siblings.length > 1 && (
            <p className="acv__rank">
              {words.rank
                .replace('{rank}', String(rank))
                .replace('{total}', String(siblings.length))
                .replace('{name}', card.name)}
            </p>
          )}
          <ul className="acv__links">
            <li>
              <a href={buildAtlasEntityPath(language, card.entity)}>
                {words.page.replace('{name}', card.name)}
              </a>
            </li>
            {sentencePath && (
              <li>
                <a href={sentencePath}>
                  <span>{words.sentence}</span>
                  {card.source}
                </a>
              </li>
            )}
            {firstPath && (
              <li>
                <a href={firstPath}>
                  <span>{words.first}</span>
                  {card.firstMention}
                </a>
              </li>
            )}
            {strongPath && (
              <li>
                <a href={strongPath}>
                  <span>{words.strong}</span>
                  {displayStrongCode(card.strong)}
                </a>
              </li>
            )}
            {seriesId && card.series && onSeries && (
              <li>
                <button type="button" onClick={() => onSeries(seriesId)}>
                  <span>{words.series}</span>
                  {card.series}
                </button>
              </li>
            )}
          </ul>
          <button type="button" className="acv__share" onClick={share}>
            {copied ? words.copied : words.share}
          </button>
        </aside>
      </div>

      <nav className="acv__bar" aria-label={card.name}>
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!previous}
          aria-label={words.previous}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <button type="button" className="acv__flip" onClick={flip}>
          {flipped ? words.front : words.flip}
        </button>
        {position >= 0 && (
          <span className="acv__position">
            {words.position
              .replace('{position}', (position + 1).toLocaleString(language))
              .replace('{count}', cards.length.toLocaleString(language))}
          </span>
        )}
        <button type="button" onClick={() => move(1)} disabled={!next} aria-label={words.next}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
          </svg>
        </button>
        <button type="button" onClick={onClose} aria-label={words.close}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </nav>
    </div>
  )
}
