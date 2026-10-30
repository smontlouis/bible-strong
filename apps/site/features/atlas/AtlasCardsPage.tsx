import { Outlet, useMatch, useNavigate } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { WEB_APP_ORIGIN } from '../resources/publicSite'
import ResourceShell from '../resources/ResourceShell'
import type { AtlasCardsPageData } from './atlas.functions'
import AtlasBooster, { BOOSTER_WORDS } from './AtlasBooster'
import AtlasCardViewer from './AtlasCardViewer'
import { cardClasses, CardFront } from './AtlasCards'
import { CARD_FAMILY_LABELS, type AtlasGalleryCard } from './atlasCardCatalog'
import {
  CARD_FAMILIES,
  cardsByEra,
  countValues,
  filterCards,
  filtersAreSet,
  NO_FILTERS,
  readCardFilters,
  writeCardFilters,
  type CardFilters,
  type CardSort,
} from './atlasCardsGallery'
import { rememberCardsPage } from './atlasCardsMemory'
import {
  buildAtlasCardPath,
  buildAtlasCardsPath,
  buildAtlasPath,
  parseAtlasCardId,
} from './atlasRoutes'
import { ATLAS_MESSAGES, countLabel } from './messages'

const WORDS = {
  fr: {
    search: 'Chercher une carte',
    searchPlaceholder: 'Moïse, Ruth, prophète, אַבְרָהָם, H1732…',
    sort: 'Ordre',
    sorts: { bible: 'Ordre biblique', name: 'De A à Z', named: 'Les plus nommés' },
    allFamilies: 'Toutes',
    eras: 'Toutes les époques',
    series: 'Toutes les séries',
    roles: 'Tous les rôles',
    stages: 'Étapes de vie',
    clear: 'Effacer les filtres',
    empty: 'Aucune carte ne répond à cette recherche.',
    unavailable:
      'Les cartes ne peuvent pas être lues pour le moment. Revenez dans quelques minutes.',
    filters: 'Filtres',
  },
  en: {
    search: 'Search a card',
    searchPlaceholder: 'Moses, Ruth, prophet, אַבְרָהָם, H1732…',
    sort: 'Order',
    sorts: { bible: 'Order of the Bible', name: 'A to Z', named: 'Most named' },
    allFamilies: 'All',
    eras: 'Every era',
    series: 'Every series',
    roles: 'Every role',
    stages: 'Life stages',
    clear: 'Clear the filters',
    empty: 'No card answers this search.',
    unavailable: 'The cards cannot be read right now. Come back in a few minutes.',
    filters: 'Filters',
  },
} as const

/** How many cards stand in the fan of the opening. */
const FAN = 5

/** A card as the grid draws it: still, its foil at rest, a link to its own address. */
function GridCard({
  card,
  href,
  onOpen,
}: {
  card: AtlasGalleryCard
  href: string
  onOpen: (card: AtlasGalleryCard, place: Element) => void
}) {
  return (
    <li className="acg__item">
      <a
        className="acg__link"
        href={href}
        data-card-id={card.id}
        aria-label={`${card.name}, ${card.title}`}
        onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)
            return
          event.preventDefault()
          onOpen(card, event.currentTarget)
        }}
      >
        <span className={`${cardClasses(card)} acg__card`}>
          <span className="ac-face ac-front">
            <CardFront card={card} grid />
          </span>
        </span>
      </a>
    </li>
  )
}

/**
 * `/atlas/:language/cards` — every card, sorted and filtered in the page, with a card opened at its
 * own address over it and packs to open for fun.
 */
export default function AtlasCardsPage({ page }: { page: AtlasCardsPageData }) {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  const words = WORDS[language]
  const navigate = useNavigate()
  // The card opened is the child route's: the gallery is its parent, and stays drawn under it.
  const opened = useMatch({ from: '/atlas/$language_/cards/$card', shouldThrow: false })
  const openId = parseAtlasCardId(opened?.params.card)
  const [filters, setFilters] = useState<CardFilters>(NO_FILTERS)
  const [booster, setBooster] = useState(false)
  // Where the card opened came from: the grid, the fan of the opening or a pack.
  const opening = useRef<{ id: string; place: Element }>(undefined)
  const grid = useRef<HTMLDivElement>(null)

  useEffect(() => rememberCardsPage(page), [page])

  // The filters are in the fragment of the address: a filtered gallery can be shared, and the
  // server, which never sees a fragment, keeps one page.
  useEffect(() => {
    const read = () => setFilters(readCardFilters(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const update = (change: Partial<CardFilters>) => {
    setFilters(current => {
      const next = { ...current, ...change }
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${writeCardFilters(next)}`
      )
      return next
    })
  }

  const query = useDeferredValue(filters.query)
  const shown = useMemo(
    () => filterCards(page.cards, { ...filters, query }),
    [page.cards, filters, query]
  )
  const sections = useMemo(
    () =>
      filters.sort === 'bible'
        ? cardsByEra(shown)
        : [{ era: undefined, eraRank: -1, cards: shown }],
    [shown, filters.sort]
  )
  const eras = useMemo(
    () => cardsByEra(page.cards).map(group => ({ ...group, count: group.cards.length })),
    [page.cards]
  )
  const roles = useMemo(() => countValues(page.cards.flatMap(card => card.roles)), [page.cards])
  const byEntity = useMemo(() => {
    const map = new Map<string, AtlasGalleryCard[]>()
    for (const card of page.cards) map.set(card.entity, [...(map.get(card.entity) ?? []), card])
    return map
  }, [page.cards])
  const fan = useMemo(
    () =>
      [...new Map(page.cards.filter(card => !card.scene).map(card => [card.entity, card])).values()]
        .sort((left, right) => right.chapterCount - left.chapterCount)
        .slice(0, FAN),
    [page.cards]
  )

  const openCard = openId ? page.cards.find(card => card.id === openId) : undefined
  const travelled = openCard && shown.some(card => card.id === openCard.id) ? shown : page.cards

  const hash = () => (typeof window === 'undefined' ? '' : window.location.hash)
  const gridCard = (id: string) =>
    document.querySelector<HTMLElement>(`.acg__link[data-card-id="${CSS.escape(id)}"]`)
  const open = useCallback(
    (card: AtlasGalleryCard, place: Element) => {
      opening.current = { id: card.id, place }
      void navigate({
        href: `${buildAtlasCardPath(language, card.id)}${hash()}`,
        resetScroll: false,
      })
    },
    [language, navigate]
  )
  /** The card goes back where it came from; another one, reached with the arrows, to the grid. */
  const placeOf = (id: string) =>
    opening.current?.id === id
      ? opening.current.place
      : opening.current?.place.matches('.acg__link')
        ? gridCard(id)
        : undefined
  const close = () => {
    // Opened from the grid and moved on with the arrows, the page follows to the last card seen.
    // Anywhere else it stays where the reader left it.
    const place = openId ? placeOf(openId) : undefined
    if (openId !== opening.current?.id) place?.scrollIntoView({ block: 'nearest' })
    void navigate({ href: `${buildAtlasCardsPath(language)}${hash()}`, resetScroll: false }).then(
      () => (place as HTMLElement | undefined)?.focus({ preventScroll: true })
    )
  }

  return (
    <ResourceShell
      section="atlas"
      alternatePath={
        openId
          ? buildAtlasCardPath(language === 'fr' ? 'en' : 'fr', openId)
          : buildAtlasCardsPath(language === 'fr' ? 'en' : 'fr')
      }
      appUrl={`${WEB_APP_ORIGIN}/strong`}
      wide
    >
      <section className="acg-hero">
        <div className="acg-hero__text">
          <p className="atlas-eyebrow">
            <a href={buildAtlasPath(language)}>{messages.name}</a>
          </p>
          <h1 className="atlas-title">{messages.cardsTitle}</h1>
          <p className="atlas-lead">
            {messages.cardsLead.replace('{cards}', page.cards.length.toLocaleString(language))}
          </p>
          {page.cards.length > 0 && (
            <button
              type="button"
              className="resource-cta acg-hero__pack"
              onClick={() => setBooster(true)}
            >
              {BOOSTER_WORDS[language].open}
            </button>
          )}
        </div>
        {fan.length === FAN && (
          <div className="acg-fan" aria-hidden="true">
            {fan.map((card, index) => (
              <a
                key={card.id}
                href={buildAtlasCardPath(language, card.id)}
                tabIndex={-1}
                className="acg-fan__card"
                style={{ '--acg-index': index - (FAN - 1) / 2 } as React.CSSProperties}
                onClick={event => {
                  event.preventDefault()
                  open(card, event.currentTarget)
                }}
              >
                <span className={`${cardClasses(card)} acg__card`}>
                  <span className="ac-face ac-front">
                    <CardFront card={card} grid />
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {page.cards.length === 0 ? (
        <p className="acg__empty">{words.unavailable}</p>
      ) : (
        <div className="acg" ref={grid}>
          <div className="acg__tools">
            <div className="acg__search atlas-search">
              <label className="sr-only" htmlFor="acg-search">
                {words.search}
              </label>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="atlas-search__icon">
                <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="m13.2 13.2 3.6 3.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                id="acg-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder={words.searchPlaceholder}
                value={filters.query}
                onChange={event => update({ query: event.target.value })}
                onKeyDown={event => {
                  if (event.key === 'Escape') update({ query: '' })
                }}
              />
            </div>
            <div className="acg__filters" role="group" aria-label={words.filters}>
              <label className="acg__select">
                <span className="sr-only">{words.sort}</span>
                <select
                  value={filters.sort}
                  onChange={event => update({ sort: event.target.value as CardSort })}
                >
                  {(Object.keys(words.sorts) as CardSort[]).map(sort => (
                    <option key={sort} value={sort}>
                      {words.sorts[sort]}
                    </option>
                  ))}
                </select>
              </label>
              <span className="acg__divider" aria-hidden="true" />
              <button
                type="button"
                className="acg__chip"
                aria-pressed={!filters.family}
                onClick={() => update({ family: undefined })}
              >
                {words.allFamilies}
              </button>
              {CARD_FAMILIES.map(family => (
                <button
                  key={family}
                  type="button"
                  className="acg__chip"
                  data-family={family}
                  aria-pressed={filters.family === family}
                  onClick={() => update({ family: filters.family === family ? undefined : family })}
                >
                  {CARD_FAMILY_LABELS[family][language]}
                </button>
              ))}
              <button
                type="button"
                className="acg__chip"
                aria-pressed={filters.stages}
                onClick={() => update({ stages: !filters.stages })}
              >
                {words.stages}
              </button>
              <label className="acg__select" data-set={filters.era !== undefined || undefined}>
                <span className="sr-only">{words.eras}</span>
                <select
                  value={filters.era ?? ''}
                  onChange={event =>
                    update({
                      era: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                >
                  <option value="">{words.eras}</option>
                  {eras.map(era => (
                    <option key={era.eraRank} value={era.eraRank}>
                      {era.era} · {era.count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="acg__select" data-set={filters.series ? true : undefined}>
                <span className="sr-only">{words.series}</span>
                <select
                  value={filters.series ?? ''}
                  onChange={event => update({ series: event.target.value || undefined })}
                >
                  <option value="">{words.series}</option>
                  {page.series.map(series => (
                    <option key={series.id} value={series.id}>
                      {series.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="acg__select" data-set={filters.role ? true : undefined}>
                <span className="sr-only">{words.roles}</span>
                <select
                  value={filters.role ?? ''}
                  onChange={event => update({ role: event.target.value || undefined })}
                >
                  <option value="">{words.roles}</option>
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.value} · {role.count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="acg__count" aria-live="polite">
              {countLabel(messages.cardsCount, shown.length, language)}
              {filtersAreSet(filters) && (
                <button
                  type="button"
                  className="acg__clear"
                  onClick={() => update({ ...NO_FILTERS, sort: filters.sort })}
                >
                  {words.clear}
                </button>
              )}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="acg__empty">{words.empty}</p>
          ) : (
            sections.map(section => (
              <section key={section.eraRank} className="acg__section">
                {section.era !== undefined && (
                  <h2 className="acg__era">
                    {section.era}
                    <span>{countLabel(messages.cardsCount, section.cards.length, language)}</span>
                  </h2>
                )}
                <ul className="acg__grid">
                  {section.cards.map(card => (
                    <GridCard
                      key={card.id}
                      card={card}
                      href={buildAtlasCardPath(language, card.id)}
                      onOpen={open}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {booster && (
        <AtlasBooster
          cards={page.cards}
          language={language}
          onClose={() => setBooster(false)}
          onOpenCard={open}
        />
      )}

      <AnimatePresence>
        {openCard && (
          <AtlasCardViewer
            key="card"
            card={openCard}
            cards={travelled}
            siblings={byEntity.get(openCard.entity) ?? [openCard]}
            language={language}
            placeOf={placeOf}
            onClose={close}
            onMove={card =>
              void navigate({
                href: `${buildAtlasCardPath(language, card.id)}${hash()}`,
                replace: true,
                resetScroll: false,
              })
            }
            onSeries={series => {
              setBooster(false)
              update({ ...NO_FILTERS, series })
              close()
              window.requestAnimationFrame(() => grid.current?.scrollIntoView({ block: 'start' }))
            }}
          />
        )}
      </AnimatePresence>
      <Outlet />
    </ResourceShell>
  )
}
