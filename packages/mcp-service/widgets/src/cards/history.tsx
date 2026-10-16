import type { EntityCard, TimelineCard, TimelineEventCard } from '../../../src/cards/types'
import { ChipLink, Clamp, Frame, RichText, Section, SiteLink, useCard } from '../ui'

// --- Events of the timeline ----------------------------------------------------------

export const Timeline = ({ card }: { card: TimelineCard }) => {
  const { host, state, t, go } = useCard()
  return (
    <Frame
      universe="references"
      lang={card.language}
      eyebrow={t.timeline}
      title={card.title}
      subtitle={card.subtitle}
      actions={<SiteLink url={card.url} />}
    >
      {card.periods ? (
        <ul class="list">
          {card.periods.map(period => (
            <li>
              <button
                type="button"
                class="row"
                onClick={() => void host.open(go.period(period.period, period.title))}
                disabled={state.busy}
              >
                <span class="row-line">
                  <span class="row-title">
                    {period.period}. {period.title}
                  </span>
                  <span class="row-meta">{period.span}</span>
                </span>
                <span class="row-meta">{period.era}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : card.events.length ? (
        // Events are looked at side by side: a row that is swept through.
        <ul class="carousel" aria-label={card.title}>
          {card.events.map(event => (
            <li>
              <button
                type="button"
                class="slide"
                onClick={() => void host.open(go.event(event.slug, event.title))}
                disabled={state.busy}
              >
                {event.image ? (
                  <img src={event.image.small} alt={event.image.caption} loading="lazy" />
                ) : (
                  <span class="slide-blank" aria-hidden="true" />
                )}
                <span class="row-meta">{event.dates}</span>
                <span class="row-title">{event.title}</span>
                <span class="slide-text">{event.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="note">{t.nothing}</p>
      )}
    </Frame>
  )
}

// --- One event -----------------------------------------------------------------------

export const TimelineEvent = ({ card }: { card: TimelineEventCard }) => {
  const { state, t, go } = useCard()
  return (
    <Frame
      universe="references"
      lang={card.language}
      eyebrow={[t.timeline, card.period].filter(Boolean).join(' · ')}
      title={card.title}
      subtitle={card.dates}
      actions={<SiteLink url={card.url} />}
    >
      {card.image ? (
        <figure class="figure">
          <img
            src={state.mode === 'fullscreen' ? card.image.large : card.image.small}
            alt={card.image.caption}
          />
          {card.image.caption ? <figcaption>{card.image.caption}</figcaption> : null}
        </figure>
      ) : null}
      <Clamp height={200}>
        <RichText
          blocks={[{ t: 'p', c: [{ t: 'text', text: card.summary, b: true }] }, ...card.article]}
        />
      </Clamp>
      {card.passages.length ? (
        <Section title={t.passages}>
          <div class="chips">
            {card.passages.map(passage => (
              <ChipLink target={go.passage(passage.osis, passage.label)}>{passage.label}</ChipLink>
            ))}
          </div>
        </Section>
      ) : null}
      {card.related.length ? (
        <Section title={t.relatedEvents}>
          <div class="chips">
            {card.related.map(event => (
              <ChipLink target={go.event(event.slug, event.title)}>{event.title}</ChipLink>
            ))}
          </div>
        </Section>
      ) : null}
    </Frame>
  )
}

// --- A person, a place -----------------------------------------------------------------

export const Entity = ({ card }: { card: EntityCard }) => {
  const { t, go } = useCard()
  const kind =
    card.category === 'person' ? t.person : card.category === 'place' ? t.place : t.group
  // Relations of one kind are read together: « Enfant : Isaac, Ismaël ».
  const relations = new Map<string, EntityCard['relations']>()
  for (const relation of card.relations) {
    relations.set(relation.label, [...(relations.get(relation.label) ?? []), relation])
  }
  return (
    <Frame
      universe="dictionary"
      lang={card.language}
      eyebrow={kind}
      title={card.title}
      subtitle={card.brief}
      actions={<SiteLink url={card.url} />}
    >
      <Clamp height={220}>
        <RichText blocks={card.body} />
      </Clamp>
      {card.place?.area || card.place?.latitude !== undefined ? (
        <dl class="facts">
          {card.place.area ? (
            <>
              <dt>{t.area}</dt>
              <dd>{card.place.area}</dd>
            </>
          ) : null}
          {card.place.latitude !== undefined && card.place.longitude !== undefined ? (
            <>
              <dt>{t.coordinates}</dt>
              <dd>
                {card.place.latitude.toFixed(3)}, {card.place.longitude.toFixed(3)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {[...relations].map(([label, members]) => (
        <Section title={label}>
          <div class="chips">
            {members.map(member =>
              member.uniqueName ? (
                <ChipLink target={go.entity(member.uniqueName, member.name)}>{member.name}</ChipLink>
              ) : (
                <span class="chip chip-neutral">{member.name}</span>
              )
            )}
          </div>
        </Section>
      ))}
      {card.codes.length ? (
        <Section title={t.names}>
          <div class="chips">
            {card.codes.map(code => (
              <ChipLink target={go.strong(code.code, code.label)}>{code.label}</ChipLink>
            ))}
          </div>
        </Section>
      ) : null}
    </Frame>
  )
}
