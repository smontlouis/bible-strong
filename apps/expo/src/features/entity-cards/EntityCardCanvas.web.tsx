import '@bible-strong/entity-cards/cards.css'

import { CARD_WORDS } from '@bible-strong/entity-cards'
import { CardBack, CardFront, cardClasses, useCardTilt } from '@bible-strong/entity-cards/web'
import { useEffect, useState, type CSSProperties } from 'react'
import { View } from 'react-native'

import type { EntityCardView } from './cardCatalog'
import { CARD_RATIO } from './cardGeometry'

/** The room around the card, in shares of its width, for its turn and its glow. */
const ROOM = 0.14

/** The size a card of this width takes on screen, with the room for its turn and its glow. */
export const getEntityCardCanvasSize = (width: number) => {
  const pad = Math.round(ROOM * width)
  return { width: width + 2 * pad, height: Math.round(width * CARD_RATIO) + 2 * pad, pad }
}

type EntityCardCanvasProps = {
  card: EntityCardView
  /** The width of the card itself; the box is larger by its room. */
  width: number
  /** The pointer moves it on the Web; there is no tilt of the device to read. */
  moves?: boolean
  /** The card is on the page; its pictures load as images of the page do. */
  onReady?: () => void
}

/**
 * A collectible card on the Web and in the desktop app: the atlas's own CSS card (ADR-0113),
 * tilting under the pointer and turning over at a click, in the room the Skia card takes on a
 * phone.
 */
export const EntityCardCanvas = ({ card, width, onReady }: EntityCardCanvasProps) => {
  useEffect(() => {
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const canvas = getEntityCardCanvasSize(width)
  const words = CARD_WORDS[card.language]
  const [flipped, setFlipped] = useState(false)
  const { element, surface, springs, kick, handlers } = useCardTilt<
    HTMLDivElement,
    HTMLButtonElement
  >()

  const flip = () => {
    springs.current.flip.t = flipped ? 0 : 180
    kick()
    setFlipped(!flipped)
  }

  return (
    <View
      style={{
        width: canvas.width,
        height: canvas.height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={element}
        className={`${cardClasses(card)} is-active`}
        style={{ '--ac-w': `${width}px`, width } as CSSProperties}
      >
        <div className="ac-translater">
          <button
            ref={surface}
            type="button"
            className="ac-rotator"
            aria-label={`${card.name}, ${card.title}. ${flipped ? words.front : words.flip}`}
            {...handlers}
            onClick={flip}
          >
            <div className="ac-face ac-front">
              <CardFront card={card} />
            </div>
            <div className="ac-face ac-back">
              <CardBack card={card} language={card.language} rank={card.rank} total={card.total} />
            </div>
          </button>
        </div>
      </div>
    </View>
  )
}
