import { animate, AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { Pack, PackOutlines } from './AtlasBooster'
import { BOOSTER_WORDS } from './atlasBoosterWords'
import { CARD_WORDS, cardClasses, CardFront } from './AtlasCards'
import { CARD_FAMILY_LABELS, type AtlasGalleryCard } from './atlasCardCatalog'
import { cardPacks, drawStandPack, PACK_SIZE, type CardPack } from './atlasCardsGallery'
import { useCardSway, useCardTilt } from './useCardTilt'

// The cards on a screen of a stand, with no one at the controls: a pack tears itself open, its five
// cards are turned over one after the other beside what they hold, then the next pack comes. The
// visitor scans the code and opens their own pack on their phone.

const STAND_WORDS = {
  fr: {
    atlas: 'Atlas de la Bible',
    newPack: 'Nouveau paquet',
    packLead: 'Cinq cartes tirées parmi {count}.',
    rank: 'Carte {rank} sur {count}',
    yourTurn: 'À vous d’ouvrir un paquet',
    yourTurnLead: 'Scannez le code : cinq cartes vous attendent sur votre téléphone.',
    scanTitle: 'Ouvrez votre paquet',
    scanLead: 'Scannez ce code',
  },
  en: {
    atlas: 'Bible Atlas',
    newPack: 'A new pack',
    packLead: 'Five cards drawn from {count}.',
    rank: 'Card {rank} of {count}',
    yourTurn: 'Your turn to open a pack',
    yourTurnLead: 'Scan the code: five cards are waiting on your phone.',
    scanTitle: 'Open your pack',
    scanLead: 'Scan this code',
  },
} as const

/** How long a card stays in front, with what it holds beside it. */
const CARD_TIME = 8000
/** The time for a card to come forward and turn over, before the reading time starts. */
const CARD_MOVE = 900
/** A stand on a poor network keeps going with the packs it holds. */
const LOAD_PATIENCE = 5000
const PACKS_HELD = 12
/** What a new pack and its cards take to create, before they are seen to move. */
const CREATION_TIME = 900

type Phase =
  'waiting' | 'sealed' | 'tearing' | 'rising' | 'dropping' | 'fanned' | 'dealing' | 'clearing'
type Deal = { pack: CardPack; cards: AtlasGalleryCard[] }
type Place = { x: number; y: number; scale: number; rotate: number; opacity: number }

// The stand is laid out on 1920 by 1080: every place is scaled by the window.
const HERO = { x: 530, y: 566 }
const TRAY = { x: 1066, y: 930, step: 92, scale: 0.19 }
/** Below the window: a pack and its cards come up from there together. */
const PACK_START = 1500
const ARRIVAL = { type: 'spring', visualDuration: 0.72, bounce: 0.14 } as const

const middle = (index: number) => index - (PACK_SIZE - 1) / 2

const placeOf = (index: number, phase: Phase, focus: number): Place => {
  const rank = middle(index)
  const tray = {
    x: TRAY.x + index * TRAY.step,
    y: TRAY.y,
    scale: TRAY.scale,
    rotate: 0,
    opacity: 1,
  }
  switch (phase) {
    // Below the window while the browser creates them, on a screen where nothing moves.
    case 'waiting':
      return { x: HERO.x, y: PACK_START, scale: 0.5, rotate: 0, opacity: 1 }
    // Drawn behind the pack from the start, so that the browser has nothing to draw as it tears.
    case 'sealed':
    case 'tearing':
      return { x: HERO.x, y: HERO.y, scale: 0.5, rotate: 0, opacity: 1 }
    case 'rising':
      return { x: HERO.x + rank * 8, y: HERO.y - 300, scale: 0.54, rotate: rank * 2, opacity: 1 }
    case 'dropping':
      return { x: HERO.x + rank * 8, y: HERO.y - 40, scale: 0.56, rotate: rank * 2, opacity: 1 }
    case 'fanned':
      return {
        x: HERO.x + rank * 122,
        y: HERO.y + rank * rank * 15,
        scale: 0.62,
        rotate: rank * 8,
        opacity: 1,
      }
    case 'dealing':
      return index === focus ? { ...HERO, scale: 1, rotate: 0, opacity: 1 } : tray
    case 'clearing':
      return { ...tray, y: tray.y + 240, opacity: 0 }
  }
}

// ---------- The pictures ----------

// Every picture stays held here, so that a stand which loses its network keeps what it has shown.
const pictures = new Map<string, Promise<boolean>>()

const loadPicture = (url: string) => {
  const known = pictures.get(url)
  if (known) return known
  const image = new Image()
  const loaded = new Promise<boolean>(resolve => {
    image.onload = () => resolve(true)
    image.onerror = () => {
      pictures.delete(url)
      resolve(false)
    }
  })
  image.src = url
  pictures.set(url, loaded)
  return loaded
}

const smallDecor = (url: string) => url.replace('/w768.webp', '/w384.webp')
const groundOf = (card: AtlasGalleryCard) => smallDecor(card.backdrop ?? card.picture)

const loadDeal = async ({ pack, cards }: Deal) => {
  const urls = [...pack.cover, ...cards].flatMap(card => [
    card.picture,
    ...(card.backdrop ? [card.backdrop, smallDecor(card.backdrop)] : []),
  ])
  return (await Promise.all(urls.map(loadPicture))).every(Boolean)
}

const pause = (duration: number) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, duration)
  })

/** Draws pack after pack, and falls back on those already loaded when the pictures do not come. */
const createDealer = (cards: AtlasGalleryCard[], language: ResourceLanguage) => {
  const pool = cards.filter(card => card.family !== 'idol')
  const packs = cardPacks(pool, BOOSTER_WORDS[language].everything)
  const seen = new Set<string>()
  const held: Deal[] = []
  let turn = Math.floor(Math.random() * packs.length)

  const draw = (): Deal => {
    const pack = packs[turn % packs.length]
    turn += 1
    if (seen.size > pool.length * 0.8) seen.clear()
    const from = pack.era === undefined ? pool : pool.filter(card => card.eraRank === pack.era)
    const drawn = drawStandPack(from, seen)
    for (const card of drawn) seen.add(card.id)
    return { pack, cards: drawn }
  }

  const fetchDeal = async () => {
    const deal = draw()
    const ready = await Promise.race([loadDeal(deal), pause(LOAD_PATIENCE).then(() => false)])
    if (ready) held.push(deal)
    return ready ? deal : undefined
  }

  return {
    next: async () =>
      (await fetchDeal()) ?? held[Math.floor(Math.random() * held.length)] ?? draw(),
    /** The reserve for the network to fail: fetched one after the other, behind the show. */
    stock: async (keepGoing: () => boolean) => {
      for (let count = 0; count < PACKS_HELD && keepGoing(); count += 1) await fetchDeal()
    },
  }
}

// ---------- A card ----------

function StandCard({
  card,
  size,
  place,
  turned,
  front,
}: {
  card: AtlasGalleryCard
  size: number
  place: Place
  turned: boolean
  front: boolean
}) {
  const { element, springs, kick } = useCardTilt<HTMLDivElement, HTMLDivElement>()
  useCardSway(springs, kick, front)
  const scaled = { ...place, x: place.x * size, y: place.y * size }
  return (
    <motion.div
      className="acs__slot"
      style={{ zIndex: front ? 5 : 2 }}
      initial={scaled}
      animate={scaled}
      transition={ARRIVAL}
    >
      <div ref={element} className={`${cardClasses(card)} acb__card ${turned ? 'is-turned' : ''}`}>
        <div className="acb__tilt">
          <span className="acb__flipper">
            <span className="acb__face acb__face--back">
              <span className="acb__reverse">
                <img className="acb__mark" src="/images/bible-strong-mark.svg" alt="" />
                <span className="acb__name">Bible Strong</span>
              </span>
            </span>
            <span className="acb__face acb__face--front">
              <span className="ac-face ac-front">
                <CardFront card={card} />
              </span>
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ---------- What stands beside the card ----------

const REVEAL = {
  hidden: {},
  shown: { transition: { delayChildren: 0.4, staggerChildren: 0.26 } },
  gone: { opacity: 0, transition: { duration: 0.22 } },
}
const LINE = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
}

function CardFacts({
  card,
  rank,
  language,
}: {
  card: AtlasGalleryCard
  rank: number
  language: ResourceLanguage
}) {
  const words = STAND_WORDS[language]
  const facts = CARD_WORDS[language]
  return (
    <>
      <motion.p className="acs__eyebrow" variants={LINE}>
        {words.rank.replace('{rank}', String(rank)).replace('{count}', String(PACK_SIZE))}
        {' · '}
        {card.era || CARD_FAMILY_LABELS[card.family][language]}
      </motion.p>
      <motion.h1 className={`acs__name ${card.name.length > 15 ? 'is-long' : ''}`} variants={LINE}>
        {card.name}
      </motion.h1>
      <motion.p className="acs__title" variants={LINE}>
        {card.title}
      </motion.p>
      <motion.div className="acs__word" variants={LINE}>
        <span className="acs__original" lang={card.script}>
          {card.original}
        </span>
        <span className="acs__reading">
          {card.transliteration && <span>{card.transliteration}</span>}
          {card.strong && <span className="acs__strong">{card.strong}</span>}
          {card.meaning && (
            <span className="acs__meaning">
              {language === 'fr' ? `« ${card.meaning} »` : `“${card.meaning}”`}
            </span>
          )}
        </span>
      </motion.div>
      <motion.blockquote className="acs__sentence" variants={LINE}>
        {card.paraphrase
          ? card.sentence
          : language === 'fr'
            ? `« ${card.sentence} »`
            : `“${card.sentence}”`}
        <cite>{card.source}</cite>
      </motion.blockquote>
      <motion.dl className="acs__facts" variants={LINE}>
        <div>
          <dt>{facts.first}</dt>
          <dd>{card.firstMention}</dd>
        </div>
        <div>
          <dt>{facts.appears}</dt>
          <dd>{facts.chapters(card.chapterCount)}</dd>
        </div>
      </motion.dl>
    </>
  )
}

function Beside({
  deal,
  phase,
  focus,
  language,
}: {
  deal: Deal
  phase: Phase
  focus: number
  language: ResourceLanguage
}) {
  const words = STAND_WORDS[language]
  const card = phase === 'dealing' ? deal.cards[focus] : undefined
  const ending = phase === 'dealing' && !card
  const key = card ? card.id : ending ? 'end' : deal.pack.id
  return (
    <div className="acs__beside">
      <AnimatePresence mode="wait">
        {phase !== 'waiting' && phase !== 'clearing' && (
          <motion.div key={key} variants={REVEAL} initial="hidden" animate="shown" exit="gone">
            {card ? (
              <CardFacts card={card} rank={focus + 1} language={language} />
            ) : ending ? (
              <>
                <motion.h1 className="acs__headline" variants={LINE}>
                  {words.yourTurn}
                </motion.h1>
                <motion.p className="acs__lead" variants={LINE}>
                  {words.yourTurnLead}
                </motion.p>
              </>
            ) : (
              <>
                <motion.p className="acs__eyebrow" variants={LINE}>
                  {words.newPack}
                </motion.p>
                <motion.h1 className="acs__headline" variants={LINE}>
                  {deal.pack.title}
                </motion.h1>
                <motion.p className="acs__lead" variants={LINE}>
                  {words.packLead.replace('{count}', deal.pack.count.toLocaleString(language))}
                </motion.p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {card && <span key={card.id} className="acs__time" />}
    </div>
  )
}

// ---------- The stand ----------

const unitOfWindow = () => Math.min(window.innerWidth, (window.innerHeight * 16) / 9) / 1920

export default function AtlasCardStand({
  cards,
  language,
}: {
  cards: AtlasGalleryCard[]
  language: ResourceLanguage
}) {
  const words = STAND_WORDS[language]
  const [deal, setDeal] = useState<Deal>()
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('sealed')
  const [focus, setFocus] = useState(-1)
  const [unit, setUnit] = useState(1)
  const tearer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const measure = () => setUnit(unitOfWindow())
    measure()
    window.addEventListener('resize', measure)
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', measure)
      root.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    let live = true
    const dealer = createDealer(cards, language)
    const show = async () => {
      let upcoming = dealer.next()
      void dealer.stock(() => live)
      while (live) {
        const current = await upcoming
        if (!live) return
        setDeal(current)
        setRound(value => value + 1)
        setFocus(-1)
        setPhase('waiting')
        await pause(CREATION_TIME)
        setPhase('sealed')
        await pause(3000)
        setPhase('tearing')
        await pause(40)
        void animate(0, 1, {
          duration: 0.74,
          ease: [0.4, 0, 0.3, 1],
          onUpdate: progress =>
            tearer.current?.style.setProperty('--acp-tear', progress.toFixed(3)),
        })
        await pause(780)
        setPhase('rising')
        await pause(640)
        setPhase('dropping')
        await pause(560)
        setPhase('fanned')
        await pause(1500)
        upcoming = dealer.next()
        setPhase('dealing')
        for (let index = 0; index < PACK_SIZE && live; index += 1) {
          setFocus(index)
          await pause(CARD_MOVE + CARD_TIME)
        }
        setFocus(PACK_SIZE)
        await pause(4500)
        setPhase('clearing')
        await pause(900)
      }
    }
    void show()
    return () => {
      live = false
    }
  }, [cards, language])

  const focused = phase === 'dealing' ? deal?.cards[focus] : undefined
  const ground = focused ?? deal?.pack.cover.find(card => card.backdrop)
  const packShown = ['waiting', 'sealed', 'tearing', 'rising', 'dropping'].includes(phase)

  return (
    <div className="acs" style={{ '--u': `${unit}px` } as CSSProperties}>
      <PackOutlines />
      <div className="acs__shade" />
      <AnimatePresence>
        {ground && (
          <motion.img
            key={groundOf(ground)}
            className="acs__ground"
            src={groundOf(ground)}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.62 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          />
        )}
      </AnimatePresence>
      <div className="acs__veil" />

      <div className="acs__frame">
        <div className="acs__brand">
          <img src="/images/bible-strong-mark.svg" alt="" />
          <span>Bible Strong</span>
          <span className="acs__brand-atlas">{words.atlas}</span>
        </div>

        {deal && (
          <>
            <Beside deal={deal} phase={phase} focus={focus} language={language} />
            <div className="acs__table">
              {deal.cards.map((card, index) => (
                <StandCard
                  key={`${round}-${card.id}`}
                  card={card}
                  size={unit}
                  place={placeOf(index, phase, focus)}
                  turned={phase === 'clearing' || (phase === 'dealing' && index <= focus)}
                  front={phase === 'dealing' && index === focus}
                />
              ))}
              {packShown && (
                <motion.div
                  key={round}
                  className="acs__pack"
                  initial={{ x: HERO.x * unit, y: PACK_START * unit, rotate: -7 }}
                  animate={{
                    x: HERO.x * unit,
                    y:
                      (phase === 'waiting' ? PACK_START : phase === 'dropping' ? 1700 : HERO.y) *
                      unit,
                    rotate: phase === 'dropping' ? 8 : 0,
                    opacity: phase === 'dropping' ? 0 : 1,
                  }}
                  transition={
                    phase === 'dropping' ? { duration: 0.46, ease: [0.5, 0, 0.9, 0.4] } : ARRIVAL
                  }
                >
                  <div
                    ref={tearer}
                    className={`acb__tear ${phase === 'sealed' ? '' : 'is-tearing'} ${
                      phase === 'rising' || phase === 'dropping' ? 'is-torn' : ''
                    }`}
                  >
                    <Pack
                      pack={deal.pack}
                      language={language}
                      large
                      tilting={false}
                      swaying={phase === 'sealed'}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}

        <div className="acs__scan">
          <img src={`/images/atlas-stand-qr-${language}.svg`} alt="" />
          <p>
            <strong>{words.scanTitle}</strong>
            <span>{words.scanLead}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
