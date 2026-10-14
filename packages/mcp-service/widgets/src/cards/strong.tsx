import { useState } from 'preact/hooks'
import type {
  Card,
  Lexicon,
  StrongEntryCard,
  StrongOccurrencesCard,
  VerseWordsCard,
  WordView,
} from '../../../src/cards/types'
import type { Messages } from '../i18n'
import { MORE_TOOLS } from '../targets'
import {
  Button,
  ChipLink,
  Clamp,
  Frame,
  Open,
  RichText,
  Section,
  SiteLink,
  useCard,
  VerseRows,
} from '../ui'

const lexiconName = (t: Messages, lexicon: Lexicon) =>
  lexicon === 'hebrew' ? t.hebrewLexicon : t.greekLexicon

// --- A verse, word by word -------------------------------------------------------

export const VerseWords = ({ card }: { card: VerseWordsCard }) => {
  const { host, t, go } = useCard()
  const [picked, setPicked] = useState<WordView | undefined>()

  const pick = (word: WordView) => {
    const same = picked === word
    setPicked(same ? undefined : word)
    if (!same) {
      host.note(
        `The user picked the word ${word.original} (${word.transliteration}, “${word.gloss}”` +
          `${word.code ? `, Strong ${word.code}` : ''}) in ${card.title}.`
      )
    }
  }

  return (
    <Frame
      universe="strong"
      lang={card.language}
      eyebrow={`${t.wordByWord} · ${card.lexicon === 'hebrew' ? t.hebrew : t.greek}`}
      title={card.title}
      actions={
        <>
          {picked?.code ? (
            <Open kind="primary" target={go.strong(picked.code, picked.label)}>
              {t.openEntry} {picked.label}
            </Open>
          ) : null}
          <SiteLink url={card.url} />
        </>
      }
    >
      {card.verses.map(verse => (
        <section>
          {card.verses.length > 1 ? <h3 class="column-title">{verse.label}</h3> : null}
          {verse.translation ? (
            <p class="note">
              {verse.translation.text} ({verse.translation.version})
            </p>
          ) : null}
          <div class="words" dir={card.direction} style={{ marginTop: '12px' }}>
            {verse.words.map(word => (
              <button
                type="button"
                class="word"
                dir="ltr"
                aria-pressed={picked === word}
                onClick={() => pick(word)}
              >
                <span class="word-original" dir={card.direction} lang={card.lexicon === 'hebrew' ? 'he' : 'grc'}>
                  {word.original}
                </span>
                <span class="word-transliteration">{word.transliteration}</span>
                <span class="word-gloss">{word.gloss}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {picked ? (
        <dl class="facts" aria-live="polite">
          <dt>{t.selectedWord}</dt>
          <dd>
            <bdi lang={card.lexicon === 'hebrew' ? 'he' : 'grc'}>{picked.original}</bdi>{' '}
            <span class="transliteration">{picked.transliteration}</span>
            {picked.label ? <> <span class="code">{picked.label}</span></> : null}
          </dd>
          {picked.morphology ? (
            <>
              <dt>{t.morphology}</dt>
              <dd>{picked.morphology}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </Frame>
  )
}

// --- An entry of the lexicon -----------------------------------------------------

export const StrongEntry = ({ card }: { card: StrongEntryCard }) => {
  const { t, go } = useCard()
  const direction = card.lexicon === 'hebrew' ? 'rtl' : 'ltr'
  return (
    <Frame
      universe="strong"
      lang={card.language}
      eyebrow={`${lexiconName(t, card.lexicon)} · ${card.label}`}
      title={card.gloss}
      subtitle={card.morphology}
      actions={
        <>
          {card.occurrences ? (
            <Open
              kind="primary"
              target={go.occurrences(card.code, card.label, card.occurrences.version)}
            >
              {t.verses(card.occurrences.verses)} · {card.occurrences.version}
            </Open>
          ) : null}
          <SiteLink url={card.url} />
        </>
      }
    >
      <div>
        <div class="original" dir={direction} lang={card.lexicon === 'hebrew' ? 'he' : 'grc'}>
          {card.original}
        </div>
        <div class="transliteration">
          {card.transliteration}
          {card.pronunciation ? ` · ${card.pronunciation}` : ''}
        </div>
      </div>

      <Clamp height={220}>
        <RichText blocks={card.definition} />
        {card.more ? (
          <>
            <hr class="divider" style={{ margin: '16px 0' }} />
            <RichText blocks={card.more} />
          </>
        ) : null}
      </Clamp>

      {card.translations.length ? (
        <Section title={`${t.translatedAs} · ${card.occurrences?.version ?? ''}`}>
          <div class="chips">
            {card.translations.map(translation => (
              <span class="chip chip-neutral">
                {translation.word} <small>{translation.count}</small>
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {card.related.length ? (
        <Section title={t.relatedWords}>
          <div class="chips">
            {card.related.map(word => (
              <ChipLink target={go.strong(word.code, word.label)}>
                <span lang={word.code.startsWith('H') ? 'he' : 'grc'}>{word.original}</span>
                {word.gloss ? ` · ${word.gloss}` : ''}
              </ChipLink>
            ))}
          </div>
        </Section>
      ) : null}

      {card.entity ? (
        <Section title={card.entity.name}>
          <div class="chips">
            <ChipLink target={go.entity(card.entity.uniqueName, card.entity.name)}>
              {card.entity.brief || card.entity.name}
            </ChipLink>
          </div>
        </Section>
      ) : null}
    </Frame>
  )
}

// --- The verses holding a word -----------------------------------------------------

export const StrongOccurrences = ({ card }: { card: StrongOccurrencesCard }) => {
  const { host, state, t, go } = useCard()
  const more = () =>
    card.next &&
    host.more(
      { tool: MORE_TOOLS.strong_occurrences, args: card.next, prompt: '' },
      (current: Card, next: Card) =>
        current.kind === 'strong_occurrences' && next.kind === 'strong_occurrences'
          ? { ...next, items: [...current.items, ...next.items] }
          : current
    )
  const count = card.total ? t.verses(card.total) : undefined
  return (
    <Frame
      universe="strong"
      lang={card.language}
      eyebrow={`${t.concordance} · ${card.version}`}
      title={
        <>
          <span lang={card.code.startsWith('H') ? 'he' : 'grc'}>{card.original}</span>
          {card.original ? ' · ' : ''}
          {card.label}
        </>
      }
      subtitle={[card.gloss, count, card.scope].filter(Boolean).join(' · ')}
      actions={
        <>
          {card.next ? (
            <Button kind="primary" onClick={() => void more()} disabled={state.busy}>
              {t.showMore}
            </Button>
          ) : null}
          <SiteLink url={card.url} />
        </>
      }
    >
      {card.items.length ? (
        <VerseRows items={card.items} open={item => go.passage(item.osis, item.label, [card.version])} />
      ) : (
        <p class="note">{t.nothing}</p>
      )}
    </Frame>
  )
}
