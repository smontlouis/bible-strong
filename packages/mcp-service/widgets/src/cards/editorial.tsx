import type {
  CommentariesCard,
  DictionaryEntryCard,
  NaveTopicCard,
} from '../../../src/cards/types'
import { ChipLink, Clamp, Frame, Open, Reveal, RichText, Section, SiteLink, useCard } from '../ui'

// --- A dictionary article ----------------------------------------------------------

export const DictionaryEntry = ({ card }: { card: DictionaryEntryCard }) => {
  const { t, go } = useCard()
  return (
    <Frame
      universe="dictionary"
      lang={card.language}
      eyebrow={t.dictionary}
      title={card.title}
      subtitle={card.workTitle}
      actions={<SiteLink url={card.url} />}
    >
      <Clamp height={300}>
        <RichText blocks={card.body} />
      </Clamp>
      {card.others.length ? (
        <Section title={t.otherDictionaries}>
          <div class="chips">
            {card.others.map(other => (
              <ChipLink target={go.dictionary(other.work, other.entryId, other.word)}>
                {other.workTitle}
              </ChipLink>
            ))}
          </div>
        </Section>
      ) : null}
    </Frame>
  )
}

// --- A topic -------------------------------------------------------------------------

export const NaveTopic = ({ card }: { card: NaveTopicCard }) => {
  const { t } = useCard()
  return (
    <Frame
      universe="nave"
      lang={card.language}
      eyebrow={t.topic}
      title={card.title}
      subtitle={`${card.referenceCount} ${t.passages.toLowerCase()}`}
      actions={<SiteLink url={card.url} />}
    >
      <Clamp height={340}>
        <RichText blocks={card.outline} />
      </Clamp>
    </Frame>
  )
}

// --- What commentaries say on a verse ------------------------------------------------

export const Commentaries = ({ card }: { card: CommentariesCard }) => {
  const { host, state, t, go } = useCard()
  const inline = state.mode === 'inline'
  return (
    <Frame
      universe="commentary"
      lang={card.language}
      eyebrow={t.commentaries}
      title={card.title}
      actions={
        <Open kind="primary" target={go.crossReferences(card.osis, card.title)}>
          {t.crossReferences}
        </Open>
      }
    >
      {card.verse ? (
        <p class="reading reading-compact">
          {card.verse.text} <span class="note">({card.verse.version})</span>
        </p>
      ) : null}
      {card.items.length ? (
        // A conversation is not the place for seven comments: three open it, the rest follow.
        <Reveal
          items={card.items}
          first={3}
          render={shown =>
            shown.map(item => (
              <section>
                <hr class="divider" style={{ marginBottom: '16px' }} />
                <div class="row-line">
                  <h3 class="row-title">{item.name}</h3>
                  <span class="row-meta">{item.range}</span>
                </div>
                <p class="row-meta" style={{ margin: '0 0 8px' }}>
                  {item.author}
                </p>
                {/* Cut to a few lines in a conversation, read in full on the whole screen. */}
                <Clamp height={inline ? 108 : 100000}>
                  <RichText blocks={item.body} />
                </Clamp>
                {!inline && item.url ? (
                  <button type="button" class="link" onClick={() => host.openLink(item.url!)}>
                    {t.openInBibleStrong}
                  </button>
                ) : null}
              </section>
            ))
          }
        />
      ) : (
        <p class="note">{t.nothing}</p>
      )}
    </Frame>
  )
}
