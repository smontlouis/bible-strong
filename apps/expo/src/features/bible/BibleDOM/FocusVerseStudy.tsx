import { styled } from 'goober'
import type { CSSProperties, ReactNode } from 'react'

import { radii } from '~common/ui/surfaces'
import {
  getEntityAvatarRadius,
  getEntityPortraitGround,
  type EntityPortraitSources,
} from '~features/lexique/entityPortraits'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import { resolveUniverseColors } from '~themes/universeColors'
import type {
  FocusStudyAction,
  FocusStudyResource,
  FocusStudyTranslations,
  FocusVerseStudy as FocusVerseStudyData,
} from '../focusStudy/focusVerseStudyTypes'
import type { RootStyles } from './BibleDOMWrapper'
import { getChapterEntityAvatar } from './chapterEntityAvatar'
import { INTERFACE_FONT } from './interfaceFont'
import { withColorAlpha } from './themeOverlayColor'
import { isDarkTheme } from './utils'

const ENTITY_AVATAR_SIZE = 40

type Props = RootStyles & {
  study: FocusVerseStudyData
  translations: FocusStudyTranslations
  /** The entities of the chapter, as its end shows them; the study keeps those of its verse. */
  entities: StrongLexiconChapterEntity[]
  portraits: EntityPortraitSources
  onAction: (action: FocusStudyAction) => void
  onOpenEntity: (uniqueName: string) => void
}

// Every tap target of the study answers the finger the same way.
const Pressable = styled('button')({
  appearance: 'none',
  border: 0,
  margin: 0,
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  transition: 'opacity 180ms ease-out',
  '&:active': { opacity: 0.55 },
})

const ChevronRight = ({ color }: { color: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

/**
 * What the reader gathers under the verse it holds in focus: the verse in other Bibles, its
 * original words, the people and places it names, the passages read with it, how commentaries
 * begin on it, its topics and the dictionary articles that name it, each a door to its study
 * card or page (ADR-0088).
 */
const FocusVerseStudy = ({
  study,
  translations,
  entities,
  portraits,
  settings,
  onAction,
  onOpenEntity,
}: Props) => {
  const colors = settings.colors[settings.theme]
  const bibleFont = settings.fontFamily
  const hairline = `0.5px solid ${colors.separator}`

  const sectionTitleStyle: CSSProperties = {
    margin: '0 4px',
    fontSize: 13,
    fontWeight: 400,
    color: colors.grey,
  }
  const cardStyle: CSSProperties = {
    background: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  }
  const rowStyle = (first: boolean): CSSProperties => ({
    display: 'block',
    width: 'calc(100% - 16px)',
    marginLeft: 16,
    padding: '12px 16px 12px 0',
    boxSizing: 'border-box',
    borderTop: first ? 'none' : hairline,
    background: 'transparent',
    color: colors.default,
  })
  const bibleTextStyle: CSSProperties = {
    fontFamily: bibleFont,
    fontSize: 15,
    lineHeight: 1.6,
  }

  const section = (title: string, content: ReactNode) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      {content}
    </section>
  )
  const footer = (label: string, resource: FocusStudyResource) => (
    <Pressable
      type="button"
      onClick={() => onAction({ kind: 'open-resource', resource })}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '13px 16px',
        borderTop: hairline,
        background: 'transparent',
        color: colors.link,
        fontSize: 15,
        fontWeight: 500,
      }}
    >
      {label}
      <ChevronRight color={colors.link} />
    </Pressable>
  )
  // While a section loads, its card holds the room of a few lines.
  const placeholder = (lines: number) =>
    section(
      '',
      <div style={{ ...cardStyle, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            style={{
              height: 12,
              width: index === lines - 1 ? '60%' : '100%',
              borderRadius: radii.mark,
              background: withColorAlpha(colors.default, 0.06),
            }}
          />
        ))}
      </div>
    )
  const chips = (
    items: { key: string; label: string; action: FocusStudyAction }[],
    dotColor: string
  ) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(item => (
        <Pressable
          key={item.key}
          type="button"
          onClick={() => onAction(item.action)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: colors.surface,
            borderRadius: radii.pill,
            padding: '9px 14px',
            fontSize: 14,
            color: colors.default,
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: radii.pill, background: dotColor }}
          />
          {item.label}
        </Pressable>
      ))}
    </div>
  )

  const strongColors = resolveUniverseColors(colors, 'strong')
  const studyVerse = Number(study.verseKey.split('-')[2])
  const verseEntities = entities.filter(entity => entity.verses.includes(studyVerse))
  const portraitGround = getEntityPortraitGround(isDarkTheme(settings.theme), colors)

  return (
    <div
      style={{
        direction: 'ltr',
        textAlign: 'left',
        margin: '40px -15px 0',
        padding: '24px 16px 32px',
        borderRadius: radii.sheet,
        background: colors.canvas,
        color: colors.default,
        fontFamily: INTERFACE_FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* In a focus of several verses, the studied one is marked in the text above. */}
      {study.studyVerses.length > 1 && (
        <style>{`#verset-${studyVerse} [data-verse-text] {
          background-color: ${withColorAlpha(colors.primary, 0.1)};
          border-radius: ${radii.mark}px;
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
        }`}</style>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: '0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {translations.title}
        </h2>
        {study.studyVerses.length > 1 && (
          <div
            role="group"
            aria-label={translations.studyVerse}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px' }}
          >
            {study.studyVerses.map(verse => {
              const selected = verse === studyVerse
              return (
                <Pressable
                  key={verse}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onAction({ kind: 'study-verse', verse })}
                  style={{
                    minWidth: 52,
                    height: 36,
                    padding: '0 14px',
                    borderRadius: radii.pill,
                    border: `1px solid ${selected ? colors.link : 'transparent'}`,
                    background: colors.surface,
                    color: selected ? colors.link : colors.default,
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  v. {verse}
                </Pressable>
              )
            })}
          </div>
        )}
      </div>

      {study.versions === undefined
        ? placeholder(4)
        : study.versions.length > 0 &&
          section(
            translations.versions,
            <div style={cardStyle}>
              {study.versions.map((version, index) => (
                <div key={version.versionId} style={rowStyle(index === 0)}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.tertiary,
                      marginBottom: 4,
                    }}
                  >
                    {version.name}
                  </div>
                  <div style={bibleTextStyle}>{version.text}</div>
                </div>
              ))}
              {footer(
                study.versionsCompared ? translations.compareAll : translations.chooseVersions,
                'compare'
              )}
            </div>
          )}

      {study.words === undefined
        ? placeholder(4)
        : study.words.length > 0 &&
          section(
            translations.words,
            <div style={cardStyle}>
              {study.original && (
                <p
                  style={{
                    margin: 0,
                    padding: '14px 16px',
                    fontFamily: bibleFont,
                    fontSize: 17,
                    lineHeight: 1.6,
                  }}
                >
                  {study.original}
                </p>
              )}
              {study.words.map((word, index) => (
                <Pressable
                  key={`${word.identityKind}:${word.identityCode}`}
                  type="button"
                  onClick={() =>
                    onAction({
                      kind: 'open-word',
                      identityKind: word.identityKind,
                      identityCode: word.identityCode,
                    })
                  }
                  style={{
                    ...rowStyle(index === 0 && !study.original),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px 10px 0',
                  }}
                >
                  <span style={{ width: 92, flexShrink: 0, fontSize: 15 }}>{word.word ?? '—'}</span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontFamily: bibleFont, fontSize: 17 }}>{word.original}</span>
                    {(word.transliteration || word.gloss) && (
                      <span style={{ fontSize: 13, color: colors.grey }}>
                        {[word.transliteration, word.gloss].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.link,
                      background: strongColors.background,
                      borderRadius: radii.pill,
                      padding: '4px 9px',
                    }}
                  >
                    {word.label}
                  </span>
                </Pressable>
              ))}
              {footer(translations.wordsAll, 'strong')}
            </div>
          )}

      {verseEntities.length > 0 &&
        section(
          translations.entities,
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {verseEntities.map(entity => {
              const avatar = getChapterEntityAvatar(entity, portraits)
              return (
                <Pressable
                  key={entity.uniqueName}
                  type="button"
                  onClick={() => onOpenEntity(entity.uniqueName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '4px 14px 4px 4px',
                    borderRadius: radii.card,
                    background: colors.surface,
                    color: colors.default,
                    fontFamily: INTERFACE_FONT,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  <img
                    src={avatar.src}
                    onError={avatar.onError}
                    alt=""
                    width={ENTITY_AVATAR_SIZE}
                    height={ENTITY_AVATAR_SIZE}
                    style={{
                      display: 'block',
                      width: ENTITY_AVATAR_SIZE,
                      height: ENTITY_AVATAR_SIZE,
                      objectFit: 'cover',
                      borderRadius: getEntityAvatarRadius(ENTITY_AVATAR_SIZE),
                      background: portraitGround,
                    }}
                  />
                  {entity.name}
                </Pressable>
              )
            })}
          </div>
        )}

      {study.references === undefined
        ? placeholder(3)
        : study.references.length > 0 &&
          section(
            translations.references,
            <div style={cardStyle}>
              {study.references.map((reference, index) => (
                <Pressable
                  key={reference.verseKey}
                  type="button"
                  onClick={() => onAction({ kind: 'open-reference', verseKey: reference.verseKey })}
                  style={rowStyle(index === 0)}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.link,
                      marginBottom: 3,
                    }}
                  >
                    {reference.title}
                  </span>
                  <span style={{ ...bibleTextStyle, display: 'block', lineHeight: 1.55 }}>
                    {reference.text}
                  </span>
                </Pressable>
              ))}
              {footer(translations.referencesAll, 'reference')}
            </div>
          )}

      {study.commentaries === undefined
        ? placeholder(3)
        : study.commentaries.length > 0 &&
          section(
            translations.commentaries,
            <div style={cardStyle}>
              {study.commentaries.map((commentary, index) => (
                <Pressable
                  key={commentary.title}
                  type="button"
                  onClick={() => onAction({ kind: 'open-resource', resource: 'commentary' })}
                  style={rowStyle(index === 0)}
                >
                  <span
                    style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}
                  >
                    {commentary.title}{' '}
                    <span style={{ fontWeight: 400, color: colors.grey }}>
                      · {commentary.verses}
                    </span>
                  </span>
                  <span
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontSize: 15,
                      lineHeight: 1.5,
                    }}
                  >
                    {commentary.text}
                  </span>
                </Pressable>
              ))}
              {footer(translations.commentariesAll, 'commentary')}
            </div>
          )}

      {study.topics === undefined
        ? null
        : study.topics.length > 0 &&
          section(
            translations.topics,
            chips(
              study.topics.map(topic => ({
                key: topic.nameLower,
                label: topic.name,
                action: { kind: 'open-topic', name: topic.name, nameLower: topic.nameLower },
              })),
              resolveUniverseColors(colors, 'nave').foreground
            )
          )}

      {study.dictionary === undefined
        ? null
        : study.dictionary.length > 0 &&
          section(
            translations.dictionary,
            chips(
              study.dictionary.map(entry => ({
                key: `${entry.resourceId}:${entry.entryId}`,
                label: entry.word,
                action: { kind: 'open-dictionary', entry },
              })),
              resolveUniverseColors(colors, 'dictionary').foreground
            )
          )}
    </div>
  )
}

export default FocusVerseStudy
