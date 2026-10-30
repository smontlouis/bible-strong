import { animate, motion } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { cardClasses, CardFront } from './AtlasCards'
import type { AtlasGalleryCard } from './atlasCardCatalog'
import { cardPacks, drawPack, PACK_SIZE, type CardPack } from './atlasCardsGallery'
import { useCardTilt } from './useCardTilt'

// Packs of five cards drawn at random, opened for the pleasure of tearing them and turning the
// cards over. Nothing is kept and nothing is worth more than another (ADR-0090): a pack is a way of
// meeting characters one would not have looked for, not a collection.

export const BOOSTER_WORDS = {
  fr: {
    open: 'Ouvrir un paquet',
    choose: 'Choisissez un paquet',
    chooseLead:
      'Cinq cartes au hasard, à retourner une à une. Rien n’est gardé : ouvrez-en autant que vous voulez.',
    everything: 'Toute la Bible',
    brand: 'Atlas de la Bible',
    cards: '{count} cartes',
    perPack: '{count} cartes',
    tear: 'Touchez le paquet ou glissez dessus pour le déchirer',
    turn: 'Touchez une carte pour la retourner',
    look: 'Touchez une carte pour l’ouvrir',
    turnAll: 'Tout retourner',
    again: 'Un autre paquet',
    other: 'Changer de paquet',
    close: 'Fermer',
    hidden: 'Carte face cachée, {rank} sur {count}',
  },
  en: {
    open: 'Open a pack',
    choose: 'Choose a pack',
    chooseLead:
      'Five cards at random, to turn over one by one. Nothing is kept: open as many as you like.',
    everything: 'The whole Bible',
    brand: 'Bible Atlas',
    cards: '{count} cards',
    perPack: '{count} cards',
    tear: 'Tap the pack or swipe across it to tear it open',
    turn: 'Tap a card to turn it over',
    look: 'Tap a card to open it',
    turnAll: 'Turn them all',
    again: 'Another pack',
    other: 'Another kind of pack',
    close: 'Close',
    hidden: 'Card face down, {rank} of {count}',
  },
} as const

/** Sealed, the pack lies on the cards; torn, they rise out of it; dropped, it falls away; dealt. */
type Phase = 'sealed' | 'rising' | 'dropping' | 'dealt'

type Step = { kind: 'choose' } | { kind: 'open'; pack: CardPack; drawn: AtlasGalleryCard[] }

// ---------- The outline of a sachet ----------

const TEETH = 46
/** Where the crimp ends and the sachet tears, in fractions of its height. */
const TEAR_LINE = 0.082
// A tear never runs straight: these steps come back to it.
const JAG = [0, 2, -1, 3, 1, -2, 2, -3, 1, 3, -1, 2, -2, 0, 3, -2, 1, -3, 2, 0, -1, 3, -2, 1]

const point = (x: number, y: number) => `${x.toFixed(4)} ${y.toFixed(4)}`

/** The crimped teeth along an end of the sachet, from left to right. */
const teethAt = (edge: number, depth: number) =>
  Array.from({ length: TEETH + 1 }, (_, index) => {
    const x = 0.012 + (0.976 * index) / TEETH
    return point(x, index % 2 ? edge + depth : edge)
  })

const tornEdge = () =>
  JAG.map((step, index) =>
    point(0.012 + (0.976 * index) / (JAG.length - 1), TEAR_LINE + step * 0.0028)
  )

/** The sides, drawn in at the crimps and full in the middle, down one side then up the other. */
const RIGHT_SIDE = 'L 0.988 0.08 C 0.998 0.13 1 0.2 1 0.3 L 1 0.7 C 1 0.8 0.998 0.87 0.988 0.92'
const LEFT_SIDE = 'L 0.012 0.92 C 0.002 0.87 0 0.8 0 0.7 L 0 0.3 C 0 0.2 0.002 0.13 0.012 0.08'

const bottomTeeth = [...teethAt(0.998, -0.0055)].reverse()

const SEALED_OUTLINE = `M ${teethAt(0, 0.0055).join(' L ')} ${RIGHT_SIDE} L ${bottomTeeth.join(' L ')} ${LEFT_SIDE} Z`
const TORN_OUTLINE = `M ${tornEdge().join(' L ')} ${RIGHT_SIDE} L ${bottomTeeth.join(' L ')} ${LEFT_SIDE} Z`
const STRIP_OUTLINE = `M ${teethAt(0, 0.0055).join(' L ')} L ${[...tornEdge()].reverse().join(' L ')} Z`

function PackOutlines() {
  return (
    <svg className="sr-only" aria-hidden="true" width="0" height="0">
      <defs>
        <clipPath id="acp-sealed" clipPathUnits="objectBoundingBox">
          <path d={SEALED_OUTLINE} />
        </clipPath>
        <clipPath id="acp-torn" clipPathUnits="objectBoundingBox">
          <path d={TORN_OUTLINE} />
        </clipPath>
        <clipPath id="acp-strip" clipPathUnits="objectBoundingBox">
          <path d={STRIP_OUTLINE} />
        </clipPath>
      </defs>
    </svg>
  )
}

// ---------- A pack ----------

/** A foil sachet: a painting from edge to edge, its characters, crumpled foil over them. */
function Pack({
  pack,
  language,
  large = false,
  tilting = true,
}: {
  pack: CardPack
  language: ResourceLanguage
  large?: boolean
  tilting?: boolean
}) {
  const words = BOOSTER_WORDS[language]
  const { element, surface, handlers } = useCardTilt<HTMLSpanElement, HTMLSpanElement>()
  const decor = pack.cover.find(card => card.backdrop)?.backdrop
  // The most named stands in the middle, in front.
  const [first, second, third] = pack.cover
  const figures = [second, first, third].filter(Boolean)
  return (
    <span
      ref={element}
      className={`acp ${large ? 'acp--large' : ''}`}
      data-era={pack.era ?? 'all'}
      {...(tilting ? handlers : {})}
    >
      <span ref={surface} className="acp__tilt">
        <span className="acp__shape">
          <span className="acp__light" />
          <span className="acp__bag">
            {decor && (
              <img
                className="acp__decor"
                src={large ? decor : decor.replace('/w768.webp', '/w384.webp')}
                alt=""
                decoding="async"
              />
            )}
            <span className="acp__tint" />
            <span className="acp__figures" aria-hidden="true">
              {figures.map(card => (
                <img
                  key={card.id}
                  src={large ? card.picture : card.picture.replace('/w768.webp', '/w256.webp')}
                  alt=""
                  decoding="async"
                />
              ))}
            </span>
            <span className="acp__band">
              <span className="acp__title">{pack.title}</span>
              <span className="acp__count">
                {words.perPack.replace('{count}', String(PACK_SIZE))}
              </span>
            </span>
            <span className="acp__brand">{words.brand}</span>
            <span className="acp__crinkle" />
            <span className="acp__holo" />
            <span className="acp__gleam" />
            <span className="acp__folds" />
            <span className="acp__glare" />
            <span className="acp__crimp acp__crimp--bottom" />
            <span className="acp__crimp acp__crimp--top" />
          </span>
          <span className="acp__strip">
            <span className="acp__crimp acp__crimp--top" />
          </span>
          <span className="acp__spark" />
        </span>
      </span>
    </span>
  )
}

// ---------- A card of the hand ----------

function HandCard({
  card,
  index,
  stacked,
  turned,
  label,
  onPress,
}: {
  card: AtlasGalleryCard
  index: number
  stacked: boolean
  turned: boolean
  label: string
  onPress: (place: Element) => void
}) {
  const { element, surface, handlers } = useCardTilt<HTMLDivElement, HTMLButtonElement>()
  return (
    <motion.div
      layout
      className="acb__slot"
      initial={false}
      animate={{ rotate: stacked ? (index - 2) * 2.5 : 0 }}
      transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.18, delay: index * 0.05 }}
    >
      <div ref={element} className={`${cardClasses(card)} acb__card ${turned ? 'is-turned' : ''}`}>
        <button
          ref={surface}
          type="button"
          className="acb__tilt"
          aria-label={label}
          {...handlers}
          onClick={event => onPress(event.currentTarget)}
        >
          <span className="acb__flipper">
            <span className="acb__face acb__face--back" aria-hidden="true">
              <span className="acb__reverse" />
            </span>
            <span className="acb__face acb__face--front">
              <span className="ac-face ac-front">
                <CardFront card={card} />
              </span>
            </span>
          </span>
        </button>
      </div>
    </motion.div>
  )
}

// ---------- The table ----------

/** A pack on the table: torn with a touch or a drag, then the cards come out of it. */
function OpenPack({
  pack,
  drawn,
  language,
  onAgain,
  onOther,
  onOpenCard,
}: {
  pack: CardPack
  drawn: AtlasGalleryCard[]
  language: ResourceLanguage
  onAgain: () => void
  onOther: () => void
  onOpenCard: (card: AtlasGalleryCard, place: Element) => void
}) {
  const words = BOOSTER_WORDS[language]
  const [phase, setPhase] = useState<Phase>('sealed')
  const [tearing, setTearing] = useState(false)
  const [turned, setTurned] = useState<boolean[]>(() => drawn.map(() => false))
  const tearer = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; moved: boolean } | undefined>(undefined)
  const timers = useRef<number[]>([])
  const finished = useRef(false)

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const setTear = (progress: number) =>
    tearer.current?.style.setProperty('--acp-tear', progress.toFixed(3))

  const release = () => {
    if (finished.current) return
    finished.current = true
    navigator.vibrate?.(14)
    setPhase('rising')
    timers.current.push(
      window.setTimeout(() => setPhase('dropping'), 620),
      window.setTimeout(() => setPhase('dealt'), 1040)
    )
  }

  /** Runs the tear to its end, from wherever a drag left it. */
  const finishTear = (from = 0) => {
    if (finished.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finished.current = true
      setPhase('dealt')
      return
    }
    setTearing(true)
    void animate(from, 1, {
      duration: 0.42 * (1 - from),
      ease: [0.4, 0, 0.3, 1],
      onUpdate: setTear,
    })
    timers.current.push(window.setTimeout(release, 430 * (1 - from)))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { x: event.clientX, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start || finished.current) return
    const moved = Math.abs(event.clientX - start.x)
    if (moved < 10 && !start.moved) return
    start.moved = true
    setTearing(true)
    setTear(Math.min(moved / event.currentTarget.offsetWidth, 1) * 0.9)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    drag.current = undefined
    if (!start?.moved) return
    const reached = Number(event.currentTarget.style.getPropertyValue('--acp-tear') || 0)
    if (reached > 0.45) {
      finishTear(reached)
      return
    }
    void animate(reached, 0, {
      duration: 0.22,
      onUpdate: setTear,
      onComplete: () => setTearing(false),
    })
  }

  const allTurned = turned.every(Boolean)
  const stacked = phase !== 'dealt'

  return (
    <div className={`acb__open is-${phase}`}>
      <p className="acb__hint" aria-live="polite">
        {phase !== 'dealt' ? words.tear : allTurned ? words.look : words.turn}
      </p>
      <div className="acb__table">
        <div className={`acb__hand ${stacked ? 'is-stacked' : ''}`}>
          {drawn.map((card, index) => (
            <HandCard
              key={card.id}
              card={card}
              index={index}
              stacked={stacked}
              turned={turned[index]}
              label={
                turned[index]
                  ? `${card.name}, ${card.title}`
                  : words.hidden
                      .replace('{rank}', String(index + 1))
                      .replace('{count}', String(PACK_SIZE))
              }
              onPress={place => {
                if (stacked) return
                if (turned[index]) onOpenCard(card, place)
                else {
                  setTurned(current => current.map((value, at) => (at === index ? true : value)))
                  navigator.vibrate?.(8)
                }
              }}
            />
          ))}
        </div>
        {phase !== 'dealt' && (
          <button
            ref={tearer}
            type="button"
            className={`acb__tear ${tearing ? 'is-tearing' : ''} ${phase === 'sealed' ? '' : 'is-torn'}`}
            aria-label={words.tear}
            onClick={() => {
              if (!tearing) finishTear()
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <Pack pack={pack} language={language} large tilting={!tearing} />
          </button>
        )}
      </div>
      <div className="acb__actions" data-shown={phase === 'dealt' || undefined}>
        {!allTurned && (
          <button type="button" onClick={() => setTurned(turned.map(() => true))}>
            {words.turnAll}
          </button>
        )}
        <button type="button" className="acb__again" onClick={onAgain}>
          {words.again}
        </button>
        <button type="button" onClick={onOther}>
          {words.other}
        </button>
      </div>
    </div>
  )
}

export default function AtlasBooster({
  cards,
  language,
  onClose,
  onOpenCard,
}: {
  cards: AtlasGalleryCard[]
  language: ResourceLanguage
  onClose: () => void
  onOpenCard: (card: AtlasGalleryCard, place: Element) => void
}) {
  const words = BOOSTER_WORDS[language]
  const packs = useRef(cardPacks(cards, words.everything)).current
  const seen = useRef(new Map<string, Set<string>>())
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const [round, setRound] = useState(0)
  const dialog = useRef<HTMLDivElement>(null)

  const deal = (pack: CardPack) => {
    const pool = pack.era === undefined ? cards : cards.filter(card => card.eraRank === pack.era)
    const already = seen.current.get(pack.id) ?? new Set<string>()
    const drawn = drawPack(pool, already)
    // Once every card of the pack has come out, the next packs draw from all of them again.
    const fresh = drawn.every(card => !already.has(card.id)) ? already : new Set<string>()
    for (const card of drawn) fresh.add(card.id)
    seen.current.set(pack.id, fresh)
    setRound(value => value + 1)
    setStep({ kind: 'open', pack, drawn })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.acv')) onClose()
    }
    document.addEventListener('keydown', onKey)
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      root.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      ref={dialog}
      className="acb"
      role="dialog"
      aria-modal="true"
      aria-label={step.kind === 'choose' ? words.choose : step.pack.title}
      tabIndex={-1}
    >
      <PackOutlines />
      <div className="acb__shade" onClick={onClose} aria-hidden="true" />
      <button type="button" className="acb__close" onClick={onClose} aria-label={words.close}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>

      {step.kind === 'choose' ? (
        <div className="acb__choose">
          <h2 className="acb__heading">{words.choose}</h2>
          <p className="acb__lead">{words.chooseLead}</p>
          <div className="acb__packs">
            {packs.map((pack, index) => (
              <button
                key={pack.id}
                type="button"
                className="acb__pack"
                style={{ '--acp-lean': `${((index * 5) % 3) - 1}` } as CSSProperties}
                onClick={() => deal(pack)}
              >
                <Pack pack={pack} language={language} />
                <span className="acb__pack-count">
                  {words.cards.replace('{count}', pack.count.toLocaleString(language))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <OpenPack
          key={round}
          pack={step.pack}
          drawn={step.drawn}
          language={language}
          onAgain={() => deal(step.pack)}
          onOther={() => setStep({ kind: 'choose' })}
          onOpenCard={onOpenCard}
        />
      )}
    </div>
  )
}
