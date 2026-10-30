import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  usePresence,
  type Transition,
} from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildStrongPath, displayStrongCode, parseStrongCode } from '../strong/strongRoutes'
import { CardBack, cardClasses, CardFront } from './AtlasCards'
import { CARD_FAMILY_LABELS, type AtlasGalleryCard } from './atlasCardCatalog'
import { buildAtlasCardPath, buildAtlasEntityPath } from './atlasRoutes'
import { useCardTilt } from './useCardTilt'

// A card opened over the gallery, at its own address. Two levels move it: Motion carries the card
// from its place in the page and back, and from one card to the next with the arrows; the springs
// of the card itself tilt it under the pointer and turn it over. Beside it, where it leads: its
// character, its Strong number, its verses.

export const VIEWER_WORDS = {
  fr: {
    previous: 'Carte précédente',
    next: 'Carte suivante',
    flip: 'Verso',
    front: 'Recto',
    close: 'Fermer',
    page: 'La page de {name}',
    first: 'Première mention',
    sentence: 'La phrase de la carte',
    strong: 'Numéro Strong',
    strongs: 'Numéros Strong',
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
    flip: 'Back',
    front: 'Front',
    close: 'Close',
    page: 'The page of {name}',
    first: 'First mention',
    sentence: 'The sentence of the card',
    strong: 'Strong’s number',
    strongs: 'Strong’s numbers',
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

// The card is placed where it rises from before the browser paints it.
const useArrivalEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Where a card stands in the page, when it is on screen. */
const placeOnScreen = (element: Element | null | undefined) => {
  const rect = element?.getBoundingClientRect()
  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return undefined
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width }
}

const CARRY: Transition = { type: 'spring', visualDuration: 0.42, bounce: 0.14 }
const RETURN: Transition = { type: 'spring', visualDuration: 0.34, bounce: 0 }
const PASS: Transition = { type: 'spring', visualDuration: 0.4, bounce: 0.1 }

/** A card arriving from the side it is going to, and the one it replaces leaving by the other. */
const PASSING = {
  enter: (direction: number) => ({
    x: `${direction * 72}%`,
    rotate: direction * 6,
    scale: 0.9,
    opacity: 0,
  }),
  rest: { x: 0, rotate: 0, scale: 1, opacity: 1 },
  leave: (direction: number) => ({
    x: `${direction * -72}%`,
    rotate: direction * -6,
    scale: 0.9,
    opacity: 0,
  }),
}

/** One card: it tilts under the pointer and turns over when touched. */
function ViewerCard({
  card,
  siblings,
  language,
  flipped,
  spin,
  onFlip,
}: {
  card: AtlasGalleryCard
  siblings: AtlasGalleryCard[]
  language: ResourceLanguage
  flipped: boolean
  /** The full turn a card makes as it first comes out of the page. */
  spin: boolean
  onFlip: () => void
}) {
  const words = VIEWER_WORDS[language]
  const { element, surface, springs, kick, handlers } = useCardTilt<
    HTMLDivElement,
    HTMLButtonElement
  >({ spin })

  useEffect(() => {
    springs.current.flip.t = flipped ? 180 : 0
    kick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped])

  const rank = siblings.findIndex(item => item.id === card.id) + 1

  return (
    <div ref={element} className={`${cardClasses(card)} acv__card is-active`}>
      <div className="ac-translater">
        <button
          ref={surface}
          type="button"
          className="ac-rotator"
          aria-label={`${card.name}, ${card.title}. ${flipped ? words.front : words.flip}`}
          {...handlers}
          onClick={onFlip}
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
  )
}

/** A row of the panel: what it leads to, and an arrow that says it leads somewhere. */
function PanelRow({
  label,
  value,
  href,
  onClick,
}: {
  label?: string
  value: ReactNode
  href?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="acv__row-text">
        {label && <span className="acv__row-label">{label}</span>}
        <span className="acv__row-value">{value}</span>
      </span>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
      </svg>
    </>
  )
  return (
    <li>
      {href ? (
        <a href={href}>{content}</a>
      ) : (
        <button type="button" onClick={onClick}>
          {content}
        </button>
      )}
    </li>
  )
}

export default function AtlasCardViewer({
  card,
  cards,
  siblings,
  language,
  placeOf,
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
  /** The element a card rises from and goes back to in the page. */
  placeOf: (id: string) => Element | null | undefined
  onClose: () => void
  onMove: (card: AtlasGalleryCard) => void
  onSeries?: (series: string) => void
}) {
  const words = VIEWER_WORDS[language]
  const [present, safeToRemove] = usePresence()
  const deck = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)
  const [flipped, setFlipped] = useState(false)
  const [copied, setCopied] = useState(false)
  const [direction, setDirection] = useState<-1 | 1>(1)
  const [still, setStill] = useState(false)
  // The card that came out of the page makes a full turn on its way; the next ones slide in.
  const [spinner] = useState(() =>
    typeof document !== 'undefined' && placeOf(card.id) ? card.id : undefined
  )

  const position = cards.findIndex(item => item.id === card.id)
  const previous = position > 0 ? cards[position - 1] : undefined
  const next = position >= 0 && position < cards.length - 1 ? cards[position + 1] : undefined

  /** How far the card, at rest in the window, stands from a place in the page. */
  const distanceTo = (place: { x: number; y: number; width: number }) => {
    const rect = deck.current?.getBoundingClientRect()
    if (!rect) return undefined
    return {
      x: place.x - (rect.left + rect.width / 2 - x.get()),
      y: place.y - (rect.top + rect.height / 2 - y.get()),
      scale: (place.width / rect.width) * scale.get(),
    }
  }

  // The card rises from its place, before the browser paints it at the middle of the window.
  useArrivalEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setStill(reduced)
    const place = placeOnScreen(placeOf(card.id))
    const from = place && !reduced ? distanceTo(place) : undefined
    if (!from) return
    x.set(from.x)
    y.set(from.y)
    scale.set(from.scale)
    animate(x, 0, CARRY)
    animate(y, 0, CARRY)
    animate(scale, 1, CARRY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Closed, it goes back to its place, or fades when its place is off screen. The timer is there
  // for a page that is not painting: its animations never end.
  useEffect(() => {
    if (present) return
    setFlipped(false)
    let done = false
    const remove = () => {
      if (done) return
      done = true
      safeToRemove?.()
    }
    const timer = window.setTimeout(remove, 800)
    const place = placeOnScreen(placeOf(card.id))
    const to = place && !still ? distanceTo(place) : undefined
    const landing = to
      ? [
          animate(x, to.x, RETURN),
          animate(y, to.y, RETURN),
          animate(scale, to.scale, RETURN),
          animate(opacity, 0, { delay: 0.26, duration: 0.1 }),
        ]
      : [
          animate(scale, 0.92, { duration: still ? 0 : 0.2 }),
          animate(opacity, 0, { duration: still ? 0 : 0.2 }),
        ]
    void Promise.all(landing).then(remove)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present])

  const move = (to: -1 | 1) => {
    const target = to < 0 ? previous : next
    if (!target) return
    setDirection(to)
    setFlipped(false)
    onMove(target)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') move(-1)
      else if (event.key === 'ArrowRight') move(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, previous?.id, next?.id])

  useEffect(() => {
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = overflow
    }
  }, [])

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
  const strongs = card.strongs.filter(strong => parseStrongCode(strong.code))
  const seriesId = card.seriesIds[0]

  return (
    <div
      className={`acv ${present ? '' : 'is-leaving'}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name}, ${card.title}`}
    >
      <div className="acv__shade" onClick={onClose} aria-hidden="true" />
      {/* The stage covers the shade: a touch beside the card lands on it. */}
      <div
        className="acv__stage"
        onClick={event => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <motion.div ref={deck} className="acv__deck" style={{ x, y, scale, opacity }}>
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={card.id}
              className="acv__turn"
              custom={direction}
              variants={PASSING}
              initial="enter"
              animate="rest"
              exit="leave"
              transition={still ? { duration: 0 } : PASS}
            >
              <ViewerCard
                card={card}
                siblings={siblings}
                language={language}
                flipped={flipped}
                spin={card.id === spinner}
                onFlip={() => setFlipped(value => !value)}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <aside key={card.id} className="acv__panel">
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
            <PanelRow
              href={buildAtlasEntityPath(language, card.entity)}
              value={words.page.replace('{name}', card.name)}
            />
            {sentencePath && (
              <PanelRow href={sentencePath} label={words.sentence} value={card.source} />
            )}
            {firstPath && (
              <PanelRow href={firstPath} label={words.first} value={card.firstMention} />
            )}
            {seriesId && card.series && onSeries && (
              <PanelRow
                label={words.series}
                value={card.series}
                onClick={() => onSeries(seriesId)}
              />
            )}
          </ul>
          {strongs.length > 0 && (
            <div className="acv__strongs">
              <p className="acv__row-label">{strongs.length > 1 ? words.strongs : words.strong}</p>
              <ul>
                {strongs.map(strong => (
                  <li key={strong.code}>
                    <a href={buildStrongPath(language, strong.code)}>
                      <span className="acv__strong-code">{displayStrongCode(strong.code)}</span>
                      {strong.original && (
                        <span lang={strong.script} dir="auto">
                          {strong.original}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
        <button type="button" className="acv__flip" onClick={() => setFlipped(value => !value)}>
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
