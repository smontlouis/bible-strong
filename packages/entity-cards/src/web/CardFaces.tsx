import { CARD_FAMILY_LABELS, CARD_WORDS, type CardLanguage, type CardView } from '../index'

// The two faces of a card in HTML, drawn by `cards.css` (ADR-0113). A card in a grid is still: its
// foil and glare are not drawn.

// « ch. » reads the same in both languages.
const WORDS_CH = 'ch.'

/** The classes of a card: its family's palette, its frame and its foil. */
export const cardClasses = (card: CardView) =>
  [
    'ac-card',
    `ac-fam-${card.family}`,
    card.stages ? 'ac-stages' : '',
    `ac-fin-${card.finish}`,
    card.fadeTop ? 'ac-cut-top' : '',
  ]
    .filter(Boolean)
    .join(' ')

// A card in a grid is drawn about 110 to 220 pixels wide: the browser picks the copy it needs.
// On a phone it is told less than the card's width, so that it takes the small copies even at
// three pixels per point: a quarter of the weight, a little softer, over hundreds of cards.
const GRID_SIZES = '(max-width: 640px) 85px, 220px'
const gridSource = (url: string, small: string) =>
  `${url.replace('/w768.webp', `/${small}.webp`)} ${small.slice(1)}w, ${url} 768w`

export function CardFront({
  card,
  grid = false,
  eager = false,
}: {
  card: CardView
  grid?: boolean
  /** A card on the first screen: its pictures load with the page. */
  eager?: boolean
}) {
  const loading = eager ? 'eager' : 'lazy'
  return (
    <>
      <div className="ac-fr-bg" />
      {/* A card in a grid is still: its foil is not drawn. */}
      {!grid && <div className="ac-fr-shine" />}
      <div className="ac-art">
        <div className="ac-layer ac-plates">
          {card.scene ? (
            <img
              className="ac-scene"
              src={card.picture}
              {...(grid ? { srcSet: gridSource(card.picture, 'w256'), sizes: GRID_SIZES } : {})}
              alt=""
              loading={loading}
              decoding="async"
              draggable={false}
            />
          ) : card.backdrop ? (
            <img
              className="ac-decor"
              src={card.backdrop}
              {...(grid ? { srcSet: gridSource(card.backdrop, 'w384'), sizes: GRID_SIZES } : {})}
              alt=""
              loading={loading}
              decoding="async"
              draggable={false}
              onLoad={event => event.currentTarget.classList.add('is-loaded')}
              // Loaded before the page came to life, it fired its load with no one listening.
              ref={element => {
                if (element?.complete && element.naturalWidth) element.classList.add('is-loaded')
              }}
            />
          ) : null}
        </div>
        {!grid && <div className="ac-layer ac-shine-art" />}
        <div className="ac-layer ac-depth-name" lang={card.script} aria-hidden="true">
          <span>{card.original}</span>
        </div>
        <div className="ac-layer ac-subjects">
          {!card.scene && (
            <img
              src={card.picture}
              {...(grid ? { srcSet: gridSource(card.picture, 'w256'), sizes: GRID_SIZES } : {})}
              alt=""
              loading={loading}
              decoding="async"
              draggable={false}
            />
          )}
        </div>
      </div>
      <div className="ac-ribbon" />
      {grid ? (
        <span className="ac-name">{card.name}</span>
      ) : (
        <h3 className="ac-name">{card.name}</h3>
      )}
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
      {!grid && <div className="ac-glare" />}
    </>
  )
}

export function CardBack({
  card,
  language,
  rank,
  total,
}: {
  card: CardView
  language: CardLanguage
  rank: number
  total: number
}) {
  const words = CARD_WORDS[language]
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
              <dt>{words.rank(rank, total)}</dt>
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
