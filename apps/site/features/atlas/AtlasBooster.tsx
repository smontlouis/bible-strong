import { useEffect, useRef, useState } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { cardClasses, CardFront } from './AtlasCards'
import type { AtlasGalleryCard } from './atlasCardCatalog'
import { cardPacks, drawPack, PACK_SIZE, type CardPack } from './atlasCardsGallery'
import type { CardOrigin } from './AtlasCardViewer'

// Packs of five cards drawn at random, opened for the pleasure of turning them over. Nothing is
// kept and nothing is worth more than another (ADR-0090): a pack is a way of meeting characters
// one would not have looked for, not a collection.

export const BOOSTER_WORDS = {
  fr: {
    open: 'Ouvrir un paquet',
    choose: 'Choisissez un paquet',
    chooseLead:
      'Cinq cartes au hasard, à retourner une à une. Rien n’est gardé : ouvrez-en autant que vous voulez.',
    everything: 'Toute la Bible',
    cards: '{count} cartes',
    perPack: '{count} cartes par paquet',
    tear: 'Touchez le paquet pour l’ouvrir',
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
    cards: '{count} cards',
    perPack: '{count} cards per pack',
    tear: 'Tap the pack to open it',
    turn: 'Tap a card to turn it over',
    look: 'Tap a card to open it',
    turnAll: 'Turn them all',
    again: 'Another pack',
    other: 'Another kind of pack',
    close: 'Close',
    hidden: 'Card face down, {rank} of {count}',
  },
} as const

type Step =
  { kind: 'choose' } | { kind: 'sealed' | 'open'; pack: CardPack; drawn: AtlasGalleryCard[] }

/** The wrapper of a pack: its name, three of its characters and its foil. */
function PackWrapper({
  pack,
  language,
  large = false,
}: {
  pack: CardPack
  language: ResourceLanguage
  large?: boolean
}) {
  const words = BOOSTER_WORDS[language]
  return (
    <span
      className={`acb-wrapper ${large ? 'acb-wrapper--large' : ''}`}
      data-era={pack.era ?? 'all'}
    >
      <span className="acb-wrapper__crimp acb-wrapper__crimp--top" />
      <span className="acb-wrapper__body">
        <span className="acb-wrapper__brand">
          {language === 'fr' ? 'Atlas de la Bible' : 'Bible Atlas'}
        </span>
        <span className="acb-wrapper__figures" aria-hidden="true">
          {pack.cover.map(card => (
            <img
              key={card.id}
              src={card.picture.replace('/w768.webp', '/w256.webp')}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ))}
        </span>
        <span className="acb-wrapper__title">{pack.title}</span>
        <span className="acb-wrapper__count">
          {words.perPack.replace('{count}', String(PACK_SIZE))}
        </span>
      </span>
      <span className="acb-wrapper__crimp acb-wrapper__crimp--bottom" />
      <span className="acb-wrapper__sheen" />
    </span>
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
  onOpenCard: (card: AtlasGalleryCard, origin: CardOrigin) => void
}) {
  const words = BOOSTER_WORDS[language]
  const packs = useRef(cardPacks(cards, words.everything)).current
  const seen = useRef(new Map<string, Set<string>>())
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const [turned, setTurned] = useState<boolean[]>([])
  const [tearing, setTearing] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)

  const deal = (pack: CardPack) => {
    const pool = pack.era === undefined ? cards : cards.filter(card => card.eraRank === pack.era)
    const already = seen.current.get(pack.id) ?? new Set<string>()
    const drawn = drawPack(pool, already)
    // Once every card of the pack has come out, the next packs draw from all of them again.
    const fresh = drawn.every(card => !already.has(card.id)) ? already : new Set<string>()
    for (const card of drawn) fresh.add(card.id)
    seen.current.set(pack.id, fresh)
    setTurned(drawn.map(() => false))
    setTearing(false)
    setStep({ kind: 'sealed', pack, drawn })
  }

  const tear = () => {
    if (step.kind !== 'sealed' || tearing) return
    setTearing(true)
    navigator.vibrate?.(12)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => setStep({ ...step, kind: 'open' }), still ? 0 : 620)
  }

  const turn = (index: number) => {
    setTurned(current => current.map((value, at) => (at === index ? true : value)))
    navigator.vibrate?.(8)
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

  const allTurned = turned.length > 0 && turned.every(Boolean)

  return (
    <div
      ref={dialog}
      className="acb"
      role="dialog"
      aria-modal="true"
      aria-label={step.kind === 'choose' ? words.choose : step.pack.title}
      tabIndex={-1}
    >
      <div className="acb__shade" onClick={onClose} aria-hidden="true" />
      <button type="button" className="acb__close" onClick={onClose} aria-label={words.close}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>

      {step.kind === 'choose' && (
        <div className="acb__choose">
          <h2 className="acb__heading">{words.choose}</h2>
          <p className="acb__lead">{words.chooseLead}</p>
          <div className="acb__packs">
            {packs.map(pack => (
              <button key={pack.id} type="button" className="acb__pack" onClick={() => deal(pack)}>
                <PackWrapper pack={pack} language={language} />
                <span className="acb__pack-count">
                  {words.cards.replace('{count}', pack.count.toLocaleString(language))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step.kind === 'sealed' && (
        <div className="acb__sealed">
          <button
            type="button"
            className={`acb__tear ${tearing ? 'is-tearing' : ''}`}
            onClick={tear}
            aria-label={words.tear}
          >
            <PackWrapper pack={step.pack} language={language} large />
          </button>
          <p className="acb__hint">{words.tear}</p>
        </div>
      )}

      {step.kind === 'open' && (
        <div className="acb__open">
          <p className="acb__hint">{allTurned ? words.look : words.turn}</p>
          <div className="acb__hand">
            {step.drawn.map((card, index) => (
              <button
                key={card.id}
                type="button"
                className={`acb__card ${turned[index] ? 'is-turned' : ''}`}
                style={{ '--acb-index': index } as React.CSSProperties}
                aria-label={
                  turned[index]
                    ? `${card.name}, ${card.title}`
                    : words.hidden
                        .replace('{rank}', String(index + 1))
                        .replace('{count}', String(PACK_SIZE))
                }
                onClick={event => {
                  if (!turned[index]) {
                    turn(index)
                    return
                  }
                  const rect = event.currentTarget.getBoundingClientRect()
                  onOpenCard(card, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    width: rect.width,
                  })
                }}
              >
                <span className="acb__flipper">
                  <span className="acb__face acb__face--back" aria-hidden="true">
                    <span className="acb__reverse" />
                  </span>
                  <span className="acb__face acb__face--front">
                    <span className={cardClasses(card)}>
                      <span className="ac-face ac-front">
                        <CardFront card={card} grid />
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="acb__actions">
            {!allTurned && (
              <button type="button" onClick={() => setTurned(turned.map(() => true))}>
                {words.turnAll}
              </button>
            )}
            <button type="button" className="acb__again" onClick={() => deal(step.pack)}>
              {words.again}
            </button>
            <button type="button" onClick={() => setStep({ kind: 'choose' })}>
              {words.other}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
