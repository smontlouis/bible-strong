import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CARD_WORDS, type CardView } from '@bible-strong/entity-cards'
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
} from '@bible-strong/entity-cards/web'
import type { ResourceLanguage } from '../resources/publicSite'

// The collectible cards of ADR-0090 on an entity's page. A card tilts under the pointer, its foil
// following the light; touched, it comes forward to the middle of the window, and touched again
// it turns over. The motion follows the springs of the cards prototype (after pokemon-cards-css
// by Simon Goellner); the card itself is drawn by the shared package (ADR-0113).

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
  /** How much larger than its slot the card is laid out: its size once opened, 1 when closed. */
  size: number
}

const resize = (state: CardState, size: number) => {
  if (state.size === size) return
  state.size = size
  state.element.style.setProperty('--card-size', size.toFixed(4))
}

/** The cards of an entity, side by side; one at a time comes forward. */
export default function AtlasCards({
  cards,
  language,
}: {
  cards: CardView[]
  language: ResourceLanguage
}) {
  const words = CARD_WORDS[language]
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
      if (!moving && state.size !== 1 && activeRef.current !== state) resize(state, 1)
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
    resize(state, Math.max(state.size, state.s.sc.t))
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
  const register = (card: CardView) => {
    const known = refs.current.get(card.id)
    if (known) return known
    const callback = (element: HTMLDivElement | null) => attach(card, element)
    refs.current.set(card.id, callback)
    return callback
  }
  const attach = (card: CardView, element: HTMLDivElement | null) => {
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
      size: 1,
    }
    states.current.set(card.id, state)
    paint(element, state.s)
  }

  const handlers = (card: CardView) => {
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
            <div ref={register(card)} className={cardClasses(card)}>
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
