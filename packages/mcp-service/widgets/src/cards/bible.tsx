import { useState } from 'preact/hooks'
import type {
  BibleSearchCard,
  Card,
  CrossReferencesCard,
  PassageCard,
  PassageSection,
  VerseView,
} from '../../../src/cards/types'
import { MORE_TOOLS } from '../targets'
import { Button, ChipLink, Clamp, Frame, Open, Reveal, SiteLink, useCard, VerseRows } from '../ui'

// --- A passage -----------------------------------------------------------------

type Picked = { number: number; label: string; osis: string }

const Verse = ({
  verse,
  picked,
  onPick,
}: {
  verse: VerseView
  picked: boolean
  onPick?: () => void
}) => {
  const text = verse.parts.map(part => {
    if ('br' in part) return part.br === 'line' ? <br /> : <span class="paragraph-break" />
    let content = <>{part.text}</>
    if (part.i) content = <em>{content}</em>
    if (part.b) content = <strong>{content}</strong>
    return part.wj ? <span class="words-of-jesus">{content}</span> : content
  })
  const body = (
    <>
      <span class="verse-number">{verse.number}</span>
      {text}{' '}
    </>
  )
  return onPick ? (
    <button type="button" class="verse" aria-pressed={picked} onClick={onPick}>
      {body}
    </button>
  ) : (
    <span class="verse">{body}</span>
  )
}

/** Verses run on in a paragraph; a verse that opens one starts on its own line. */
const Reading = ({
  section,
  direction,
  compact,
  picked,
  onPick,
}: {
  section: PassageSection
  direction: 'ltr' | 'rtl'
  compact: boolean
  picked?: number
  onPick?: (verse: VerseView) => void
}) => {
  const paragraphs: VerseView[][] = []
  for (const verse of section.verses) {
    if (verse.paragraph || !paragraphs.length) paragraphs.push([verse])
    else paragraphs.at(-1)!.push(verse)
  }
  return (
    <div dir={direction}>
      {paragraphs.map(verses => (
        <p class={`reading${compact ? ' reading-compact' : ''}`}>
          {verses[0]?.heading ? <span class="heading-in-text">{verses[0].heading}</span> : null}
          {verses.map(verse => (
            <Verse
              verse={verse}
              picked={picked === verse.number}
              onPick={onPick && (() => onPick(verse))}
            />
          ))}
        </p>
      ))}
    </div>
  )
}

export const Passage = ({ card }: { card: PassageCard }) => {
  const { host, t, go } = useCard()
  const [picked, setPicked] = useState<Picked | undefined>()
  const compared = card.columns.length > 1
  const [first] = card.columns
  const sections = first?.sections ?? []
  const verseTotal = sections.reduce((total, section) => total + section.verses.length, 0)
  // One verse needs no picking: it is the one the actions are about.
  const only =
    verseTotal === 1 && sections[0]?.verses[0]
      ? { number: sections[0].verses[0].number, label: card.title, osis: card.osis }
      : undefined
  const about = picked ?? only

  const pick = (section: PassageSection, verse: VerseView) => {
    const book = section.osis.split('.')[0]
    const next: Picked = {
      number: verse.number,
      label: `${section.label.replace(/:.*$/u, '')}:${verse.number}`,
      osis: `${book}.${section.chapter}.${verse.number}`,
    }
    const same = picked?.osis === next.osis
    setPicked(same ? undefined : next)
    if (!same) host.note(`The user picked ${next.label} in the passage shown.`)
  }

  return (
    <Frame
      universe="bible"
      lang={card.language}
      eyebrow={compared ? t.comparison : `${t.bible} · ${first?.version ?? ''}`}
      title={card.title}
      subtitle={compared ? undefined : first?.versionName}
      actions={
        <>
          {about && card.words ? (
            <Open kind="primary" target={go.words(about.osis, about.label)}>
              {t.wordByWord}
            </Open>
          ) : null}
          <SiteLink url={card.url} />
        </>
      }
    >
      <Clamp height={compared ? 420 : 360}>
        <div class="columns" data-count={Math.min(card.columns.length, 2)}>
          {card.columns.map(column => (
            <div>
              {compared ? (
                <h3 class="column-title">
                  {column.version} · {column.versionName}
                </h3>
              ) : null}
              {column.sections.map(section => (
                <div>
                  {column.sections.length > 1 ? <h3 class="column-title">{section.label}</h3> : null}
                  {section.missing ? (
                    <p class="note">{t.notAvailable(column.version)}</p>
                  ) : (
                    <Reading
                      section={section}
                      direction={column.direction}
                      compact={compared}
                      picked={picked?.osis.startsWith(`${section.osis.split('.')[0]}.${section.chapter}.`) ? picked.number : undefined}
                      onPick={verseTotal > 1 ? verse => pick(section, verse) : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Clamp>
      {about ? (
        <div class="chips" aria-live="polite">
          {picked ? <span class="chip chip-neutral">{picked.label}</span> : null}
          <ChipLink target={go.commentaries(about.osis, about.label)}>{t.commentaries}</ChipLink>
          <ChipLink target={go.crossReferences(about.osis, about.label)}>
            {t.crossReferences}
          </ChipLink>
        </div>
      ) : null}
    </Frame>
  )
}

// --- Verses found --------------------------------------------------------------

export const BibleSearch = ({ card }: { card: BibleSearchCard }) => {
  const { host, state, t, go } = useCard()
  const more = () =>
    card.next &&
    host.more(
      { tool: MORE_TOOLS.bible_search, args: card.next, prompt: '' },
      (current: Card, next: Card) =>
        current.kind === 'bible_search' && next.kind === 'bible_search'
          ? { ...next, items: [...current.items, ...next.items] }
          : current
    )
  return (
    <Frame
      universe="bible"
      lang={card.language}
      eyebrow={`${card.mode === 'meaning' ? t.searchByMeaning : t.search} · ${card.version}`}
      title={card.title}
      subtitle={t.results(card.total)}
      actions={
        card.next ? (
          <Button kind="primary" onClick={() => void more()} disabled={state.busy}>
            {t.showMore}
          </Button>
        ) : undefined
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

// --- Verses linked to a verse ----------------------------------------------------

export const CrossReferences = ({ card }: { card: CrossReferencesCard }) => {
  const { t, go } = useCard()
  const rows = card.groups.flatMap(group =>
    group.items.map((item, index) => ({ ...item, phrase: index === 0 ? group.phrase : undefined }))
  )
  return (
    <Frame
      universe="references"
      lang={card.language}
      eyebrow={`${t.crossReferences} · ${card.version}`}
      title={card.title}
      actions={
        <>
          <Open kind="primary" target={go.commentaries(card.osis, card.title)}>
            {t.commentaries}
          </Open>
          <SiteLink url={card.url} />
        </>
      }
    >
      {card.verse ? <p class="reading reading-compact">{card.verse}</p> : null}
      <Reveal
        items={rows}
        first={6}
        render={shown => (
          <VerseRows
            items={shown.map(row => ({
              label: row.label,
              osis: row.osis,
              parts: [{ text: row.text ?? '' }],
              note: row.phrase,
            }))}
            open={item => go.passage(item.osis, item.label, [card.version])}
          />
        )}
      />
    </Frame>
  )
}
