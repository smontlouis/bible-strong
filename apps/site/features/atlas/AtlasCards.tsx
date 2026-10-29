import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { CARD_FAMILY_LABELS, type AtlasCardView } from './atlasCardCatalog'

// The collectible cards of ADR-0090 on an entity's page. A card tilts under the pointer, its foil
// following the light; touched, it comes forward to the middle of the window, and touched again
// it turns over. The motion follows the springs of the cards prototype (after pokemon-cards-css
// by Simon Goellner).

const WORDS = {
  fr: {
    open: 'Ouvrir la carte',
    flip: 'Retourner',
    front: 'Recto',
    close: 'Fermer',
    thisCard: 'Cette carte',
    first: 'Première mention',
    appears: 'Apparaît dans',
    chapters: (count: number) => (count > 1 ? `${count} chapitres` : 'un seul chapitre'),
    series: 'Série',
  },
  en: {
    open: 'Open the card',
    flip: 'Flip',
    front: 'Front',
    close: 'Close',
    thisCard: 'This card',
    first: 'First mention',
    appears: 'Appears in',
    chapters: (count: number) => (count > 1 ? `${count} chapters` : 'one chapter'),
    series: 'Series',
  },
} as const

// ---------- Motion ----------

type Spring = { x: number; v: number; t: number; k: number; d: number }
const spring = (value: number, k: number, d: number): Spring => ({ x: value, v: 0, t: value, k, d })

/** Moves a spring one frame; false once it has come to rest. */
const step = (s: Spring, still: boolean) => {
  if (still) {
    s.x = s.t
    s.v = 0
    return false
  }
  s.v = (s.v + (s.t - s.x) * s.k) * (1 - s.d)
  s.x += s.v
  if (Math.abs(s.v) < 0.002 && Math.abs(s.t - s.x) < 0.002) {
    s.x = s.t
    s.v = 0
    return false
  }
  return true
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max)
const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin)

// At rest the foil stays lit, as from a little above; the pointer only moves the light and adds glare.
const REST = { x: 50, y: 32, shine: 0.75 }

type Springs = Record<
  'rx' | 'ry' | 'gx' | 'gy' | 'go' | 'gl' | 'bx' | 'by' | 'tx' | 'ty' | 'sc' | 'spin' | 'flip',
  Spring
>

const restingSprings = (): Springs => ({
  rx: spring(0, 0.08, 0.26),
  ry: spring(0, 0.08, 0.26),
  gx: spring(REST.x, 0.08, 0.26),
  gy: spring(REST.y, 0.08, 0.26),
  go: spring(REST.shine, 0.08, 0.26),
  gl: spring(0, 0.08, 0.26),
  bx: spring(adjust(REST.x, 0, 100, 37, 63), 0.08, 0.26),
  by: spring(adjust(REST.y, 0, 100, 33, 67), 0.08, 0.26),
  tx: spring(0, 0.045, 0.3),
  ty: spring(0, 0.045, 0.3),
  sc: spring(1, 0.045, 0.3),
  spin: spring(0, 0.04, 0.22),
  flip: spring(0, 0.07, 0.28),
})

/** Writes the springs of a card into the CSS variables its layers read. */
const paint = (element: HTMLElement, s: Springs) => {
  const style = element.style
  const gx = s.gx.x
  const gy = s.gy.x
  style.setProperty('--pointer-x', `${gx.toFixed(2)}%`)
  style.setProperty('--pointer-y', `${gy.toFixed(2)}%`)
  style.setProperty(
    '--pointer-from-center',
    clamp(Math.sqrt((gy - 50) ** 2 + (gx - 50) ** 2) / 50, 0, 1).toFixed(3)
  )
  style.setProperty('--pointer-from-top', (gy / 100).toFixed(3))
  style.setProperty('--pointer-from-left', (gx / 100).toFixed(3))
  style.setProperty('--card-opacity', s.go.x.toFixed(3))
  style.setProperty('--glare-opacity', s.gl.x.toFixed(3))
  style.setProperty('--rotate-x', `${s.rx.x.toFixed(2)}deg`)
  style.setProperty('--rotate-y', `${s.ry.x.toFixed(2)}deg`)
  style.setProperty('--tx', (-s.rx.x / 14).toFixed(3))
  style.setProperty('--ty', (s.ry.x / 14).toFixed(3))
  style.setProperty('--background-x', `${s.bx.x.toFixed(2)}%`)
  style.setProperty('--background-y', `${s.by.x.toFixed(2)}%`)
  style.setProperty('--translate-x', `${s.tx.x.toFixed(1)}px`)
  style.setProperty('--translate-y', `${s.ty.x.toFixed(1)}px`)
  style.setProperty('--card-scale', s.sc.x.toFixed(4))
  style.setProperty('--spin', `${s.spin.x.toFixed(2)}deg`)
  style.setProperty('--flip', `${s.flip.x.toFixed(2)}deg`)
}

// The textures of the foils are drawn once in the browser: no image is borrowed.
let texturesDrawn = false
const drawTextures = () => {
  if (texturesDrawn) return
  texturesDrawn = true
  const canvas = (size: number) => {
    const element = document.createElement('canvas')
    element.width = element.height = size
    return [element, element.getContext('2d')] as const
  }
  const [glitter, g] = canvas(220)
  if (g) {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 220, 220)
    for (let index = 0; index < 700; index += 1) {
      g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.8 + 0.2).toFixed(2)})`
      g.beginPath()
      g.arc(Math.random() * 220, Math.random() * 220, Math.random() * 1.3 + 0.3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const [nebula, n] = canvas(420)
  if (n) {
    n.fillStyle = '#05030b'
    n.fillRect(0, 0, 420, 420)
    n.globalCompositeOperation = 'lighter'
    const hues = [280, 300, 190, 220, 320, 260, 170]
    for (let index = 0; index < 14; index += 1) {
      const x = Math.random() * 420
      const y = Math.random() * 420
      const radius = Math.random() * 150 + 60
      const gradient = n.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `hsla(${hues[index % hues.length]},80%,60%,0.32)`)
      gradient.addColorStop(1, 'hsla(0,0%,0%,0)')
      n.fillStyle = gradient
      n.fillRect(0, 0, 420, 420)
    }
    for (let index = 0; index < 260; index += 1) {
      n.fillStyle = `rgba(255,255,255,${(Math.random() * 0.9).toFixed(2)})`
      const big = Math.random() < 0.1 ? 2 : 1
      n.fillRect(Math.random() * 420, Math.random() * 420, big, big)
    }
  }
  const root = document.documentElement.style
  root.setProperty('--ac-glitter', `url(${glitter.toDataURL('image/png')})`)
  root.setProperty('--ac-nebula', `url(${nebula.toDataURL('image/png')})`)
}

// ---------- Faces ----------

// « ch. » reads the same in both languages.
const WORDS_CH = 'ch.'

function CardFront({ card }: { card: AtlasCardView }) {
  return (
    <>
      <div className="ac-fr-bg" />
      <div className="ac-fr-shine" />
      <div className="ac-art">
        <div className="ac-layer ac-plates">
          {card.scene ? (
            <img className="ac-scene" src={card.picture} alt="" loading="lazy" draggable={false} />
          ) : card.backdrop ? (
            <img
              className="ac-decor"
              src={card.backdrop}
              alt=""
              loading="lazy"
              draggable={false}
              onLoad={event => event.currentTarget.classList.add('is-loaded')}
              // Loaded before the page came to life, it fired its load with no one listening.
              ref={element => {
                if (element?.complete && element.naturalWidth) element.classList.add('is-loaded')
              }}
            />
          ) : null}
        </div>
        <div className="ac-layer ac-shine-art" />
        <div className="ac-layer ac-depth-name" lang={card.script} aria-hidden="true">
          <span>{card.original}</span>
        </div>
        <div className="ac-layer ac-subjects">
          {!card.scene && <img src={card.picture} alt="" loading="lazy" draggable={false} />}
        </div>
      </div>
      <div className="ac-ribbon" />
      <h3 className="ac-name">{card.name}</h3>
      <span className="ac-subtitle">{card.title}</span>
      <div className="ac-typeline">
        <span>{card.typeLine}</span>
      </div>
      <div className="ac-textbox">
        <p className="ac-flavor">
          {card.paraphrase ? (
            <span className="ac-para">{card.sentence}</span>
          ) : (
            <q>{card.sentence}</q>
          )}
          <cite>{card.source}</cite>
        </p>
      </div>
      <div className="ac-foot">
        <span>{card.foot}</span>
        <span>
          {card.chapterCount} {WORDS_CH}
        </span>
      </div>
      <div className="ac-ring" />
      <div className="ac-glare" />
    </>
  )
}

function CardBack({
  card,
  language,
  rank,
  total,
}: {
  card: AtlasCardView
  language: ResourceLanguage
  rank: number
  total: number
}) {
  const words = WORDS[language]
  return (
    <>
      <div className="ac-fr-bg" />
      <div className="ac-fr-shine" />
      <div className="ac-pattern" />
      <div className="ac-back-body">
        <div className="ac-family">{CARD_FAMILY_LABELS[card.family][language]}</div>
        <div className="ac-big" lang={card.script}>
          {card.original}
        </div>
        {card.transliteration && <div className="ac-translit">{card.transliteration}</div>}
        {card.strong && <div className="ac-strong">{card.strong}</div>}
        {card.meaning && (
          <div className="ac-meaning">
            {language === 'fr' ? `« ${card.meaning} »` : `“${card.meaning}”`}
          </div>
        )}
        <div className="ac-sep" />
        <p className="ac-brief">{card.brief}</p>
        <dl className="ac-facts">
          <dt>{words.thisCard}</dt>
          <dd>
            {card.title}
            {card.chaptersLabel ? ` · ${card.chaptersLabel}` : ''}
          </dd>
          <dt>{words.first}</dt>
          <dd>{card.firstMention}</dd>
          <dt>{words.appears}</dt>
          <dd>{words.chapters(card.chapterCount)}</dd>
          {total > 1 && (
            <>
              <dt>
                {language === 'fr' ? `Carte ${rank} sur ${total}` : `Card ${rank} of ${total}`}
              </dt>
              <dd />
            </>
          )}
          {card.series && (
            <>
              <dt>{words.series}</dt>
              <dd>{card.series}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="ac-ring" />
      <div className="ac-glare" />
    </>
  )
}

// ---------- Deck ----------

type CardState = {
  id: string
  element: HTMLElement
  slot: HTMLElement
  rotator: HTMLElement
  s: Springs
  firstPop: boolean
  endTimer?: number
  down?: { x: number; y: number }
  moved: boolean
}

/** The cards of an entity, side by side; one at a time comes forward. */
export default function AtlasCards({
  cards,
  language,
}: {
  cards: AtlasCardView[]
  language: ResourceLanguage
}) {
  const words = WORDS[language]
  const states = useRef(new Map<string, CardState>())
  const frame = useRef(0)
  const activeRef = useRef<CardState>(undefined)
  const [active, setActive] = useState<string>()
  const [flipped, setFlipped] = useState(false)
  const still = useRef(false)

  useEffect(() => {
    drawTextures()
    still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const state of states.current.values()) paint(state.element, state.s)
    return () => cancelAnimationFrame(frame.current)
  }, [])

  const tick = () => {
    let running = false
    for (const state of states.current.values()) {
      let moving = false
      for (const value of Object.values(state.s)) if (step(value, still.current)) moving = true
      // A full turn on first opening ends where it started.
      if (state.s.spin.t === 360 && Math.abs(state.s.spin.x - 360) < 0.5) {
        state.s.spin.x = 0
        state.s.spin.t = 0
        state.s.spin.v = 0
      }
      paint(state.element, state.s)
      if (moving) running = true
    }
    frame.current = running ? requestAnimationFrame(tick) : 0
  }
  const kick = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick)
  }

  const interact = (state: CardState, clientX: number, clientY: number) => {
    if (activeRef.current && activeRef.current !== state) return
    const rect = state.rotator.getBoundingClientRect()
    const px = clamp(((clientX - rect.left) / rect.width) * 100)
    const py = clamp(((clientY - rect.top) / rect.height) * 100)
    window.clearTimeout(state.endTimer)
    state.element.classList.add('is-interacting')
    const s = state.s
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
  const interactEnd = (state: CardState, delay = 400) => {
    window.clearTimeout(state.endTimer)
    state.endTimer = window.setTimeout(() => {
      const s = state.s
      state.element.classList.remove('is-interacting')
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

  /** Brings a card to the middle of the window, as large as the window allows. */
  const center = (state: CardState) => {
    const rect = state.slot.getBoundingClientRect()
    const width = state.element.offsetWidth
    const height = state.element.offsetHeight
    const toolbar = 84
    const view = document.documentElement
    state.s.tx.t = Math.round(
      view.clientWidth / 2 - (rect.left + (rect.width - width) / 2) - width / 2
    )
    state.s.ty.t = Math.round((window.innerHeight - toolbar) / 2 - rect.top - height / 2)
    state.s.sc.t = Math.min(
      (view.clientWidth / width) * 0.9,
      ((window.innerHeight - toolbar) / height) * 0.9,
      1.9
    )
  }

  const deactivate = (state: CardState) => {
    state.element.classList.remove('is-active')
    state.s.tx.t = 0
    state.s.ty.t = 0
    state.s.sc.t = 1
    state.s.flip.t = 0
    if (activeRef.current === state) {
      activeRef.current = undefined
      setActive(undefined)
      setFlipped(false)
    }
    interactEnd(state, 0)
    kick()
  }
  const activate = (state: CardState) => {
    if (activeRef.current && activeRef.current !== state) deactivate(activeRef.current)
    activeRef.current = state
    setActive(state.id)
    setFlipped(false)
    state.element.classList.add('is-active')
    center(state)
    if (state.firstPop && !still.current) {
      state.s.spin.t = 360
      state.firstPop = false
    }
    interactEnd(state, state.s.spin.t ? 900 : 100)
    kick()
  }
  const flip = (state: CardState) => {
    state.s.flip.t = state.s.flip.t ? 0 : 180
    setFlipped(Boolean(state.s.flip.t))
    kick()
  }

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeRef.current) deactivate(activeRef.current)
    }
    const follow = () => {
      if (activeRef.current) {
        center(activeRef.current)
        kick()
      }
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', follow, { passive: true })
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', follow)
      window.removeEventListener('resize', follow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // One ref callback per card, kept across renders: a new one would drop the card's springs.
  const refs = useRef(new Map<string, (element: HTMLDivElement | null) => void>())
  const register = (card: AtlasCardView) => {
    const known = refs.current.get(card.id)
    if (known) return known
    const callback = (element: HTMLDivElement | null) => attach(card, element)
    refs.current.set(card.id, callback)
    return callback
  }
  const attach = (card: AtlasCardView, element: HTMLDivElement | null) => {
    if (!element) {
      states.current.delete(card.id)
      return
    }
    if (states.current.get(card.id)?.element === element) return
    const state: CardState = {
      id: card.id,
      element,
      slot: element.parentElement ?? element,
      rotator: element.querySelector<HTMLElement>('.ac-rotator') ?? element,
      s: restingSprings(),
      firstPop: true,
      moved: false,
    }
    states.current.set(card.id, state)
    paint(element, state.s)
  }

  const handlers = (card: AtlasCardView) => {
    const state = () => states.current.get(card.id)
    return {
      onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const current = state()
        if (!current) return
        if (
          current.down &&
          Math.hypot(event.clientX - current.down.x, event.clientY - current.down.y) > 8
        ) {
          current.moved = true
        }
        if (event.pointerType === 'mouse' || (activeRef.current === current && current.down)) {
          interact(current, event.clientX, event.clientY)
        }
      },
      onPointerLeave: () => {
        const current = state()
        if (current) interactEnd(current)
      },
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const current = state()
        if (!current) return
        current.down = { x: event.clientX, y: event.clientY }
        current.moved = false
        if (activeRef.current === current) {
          event.currentTarget.setPointerCapture(event.pointerId)
          interact(current, event.clientX, event.clientY)
        }
      },
      onPointerUp: () => {
        const current = state()
        if (!current) return
        current.down = undefined
        if (activeRef.current === current) interactEnd(current, 250)
      },
      onPointerCancel: () => {
        const current = state()
        if (!current) return
        current.down = undefined
        interactEnd(current, 0)
      },
      onClick: () => {
        const current = state()
        if (!current) return
        if (current.moved) {
          current.moved = false
          return
        }
        if (activeRef.current === current) flip(current)
        else activate(current)
      },
    }
  }

  const activeCard = cards.find(card => card.id === active)

  return (
    <>
      <div className="ac-deck">
        {cards.map((card, index) => (
          <div key={card.id} className="ac-slot">
            <div
              ref={register(card)}
              className={[
                'ac-card',
                `ac-fam-${card.family}`,
                card.stages ? 'ac-stages' : '',
                `ac-fin-${card.finish}`,
                card.fadeTop ? 'ac-cut-top' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="ac-translater">
                <button
                  type="button"
                  className="ac-rotator"
                  aria-label={`${card.name}, ${card.title}. ${words.open}`}
                  {...handlers(card)}
                >
                  <div className="ac-face ac-front">
                    <CardFront card={card} />
                  </div>
                  <div className="ac-face ac-back">
                    <CardBack
                      card={card}
                      language={language}
                      rank={index + 1}
                      total={cards.length}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        className={`ac-backdrop ${active ? 'is-shown' : ''}`}
        onClick={() => activeRef.current && deactivate(activeRef.current)}
        aria-hidden="true"
      />
      <div className={`ac-toolbar ${active ? 'is-shown' : ''}`}>
        {activeCard && (
          <>
            <button type="button" onClick={() => activeRef.current && flip(activeRef.current)}>
              {flipped ? words.front : words.flip}
            </button>
            <span className="ac-toolbar__name">{activeCard.title}</span>
            <button
              type="button"
              onClick={() => activeRef.current && deactivate(activeRef.current)}
            >
              {words.close}
            </button>
          </>
        )}
      </div>
    </>
  )
}
