import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import Link from '~common/Link'
import IconTile from '~common/ui/IconTile'
import SearchTypeIcon from '~features/search/shared/SearchTypeIcon'
import type { SearchItemType } from '~state/searchFilters'
import { getBook } from '~helpers/bibleBookCatalog'
import formatVerseContent from '~helpers/formatVerseContent'
import { getHistoryStrongReference } from '~helpers/historyStrongReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import type { RootState } from '~redux/modules/reducer'
import { VersionCode } from '~state/tabs'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import type { HistoryItem } from './historyModel'

const entryKinds = {
  verse: 'passages',
  strong: 'strong',
  word: 'dictionary',
  nave: 'nave',
  study: 'studies',
  note: 'notes',
  plan: 'plan',
  meditation: 'plan',
  timeline: 'timeline',
  commentary: 'commentary',
  'commentary-resource': 'commentary',
} as const satisfies Record<HistoryItem['type'], SearchItemType>

/**
 * The resource-colored glyph of an entry in its icon tile. `bare`: the glyph alone, without its
 * tile. `size` is the glyph's.
 */
export const HistoryEntryIcon = ({
  item,
  size = 18,
  bare = false,
}: {
  item: HistoryItem
  size?: number
  bare?: boolean
}) => {
  const theme = useTheme()
  const kind = entryKinds[item.type]
  if (bare) return <SearchTypeIcon type={kind} size={size} />
  return (
    <IconTile bg={resolveUniverseColors(theme.colors, kind).background}>
      <SearchTypeIcon type={kind} size={size} />
    </IconTile>
  )
}

/** Studies and notes the user deleted since: their entries are no longer shown. */
export const useIsHistoryEntryAvailable = () => {
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  return (item: HistoryItem) => {
    if (item.type === 'study') return Boolean(studies?.[item.studyId])
    if (item.type === 'note') return Boolean(notes?.[item.noteId])
    return true
  }
}

// A study or note may have been renamed since the visit: its current title wins.
const useLiveTitle = (item: HistoryItem) =>
  useSelector((state: RootState) => {
    if (item.type === 'study') return state.user.bible.studies?.[item.studyId]?.title?.trim()
    if (item.type === 'note') {
      const note = state.user.bible.notes?.[item.noteId]
      return note ? getNoteTitle(note, '') : undefined
    }
    return undefined
  })

export const useHistoryEntryText = (item: HistoryItem): { title: string; subtitle: string } => {
  const { t } = useTranslation()
  const liveTitle = useLiveTitle(item)
  switch (item.type) {
    case 'verse': {
      // Verse 1 makes the reference read as the chapter, which is the identity of the entry.
      const { title } = formatVerseContent([
        { Livre: Number(item.book), Chapitre: Number(item.chapter), Verset: 1 },
      ])
      return { title: title.replace(/:1$/, ''), subtitle: item.version }
    }
    case 'strong': {
      const reference = getHistoryStrongReference(item)
      const original = item.Grec || item.Hebreu
      return {
        title: item.Mot,
        subtitle: [reference, original].filter(Boolean).join(' · '),
      }
    }
    case 'word':
      return { title: item.word, subtitle: item.dictionaryTitle ?? t('tabs.dictionary') }
    case 'nave':
      return { title: item.name, subtitle: t('tabs.nave') }
    case 'study':
      return {
        title: liveTitle || item.title || t('history.kinds.study'),
        subtitle: t('history.kinds.study'),
      }
    case 'note':
      return {
        title: liveTitle || item.title || item.reference || t('history.kinds.note'),
        subtitle: item.reference ?? t('history.kinds.note'),
      }
    case 'plan':
      return { title: item.title, subtitle: item.subtitle ?? t('history.kinds.plan') }
    case 'meditation':
      return { title: item.title, subtitle: item.collectionTitle ?? t('history.kinds.meditation') }
    case 'timeline':
      return { title: item.title, subtitle: item.dateLabel ?? t('tabs.timeline') }
    case 'commentary':
      return {
        title: formatVerseContent([item.verse]).title,
        subtitle: t('history.kinds.commentary'),
      }
    case 'commentary-resource':
      // The passage tells apart a chapter and its sections, which share the work's title.
      return { title: item.passage, subtitle: item.title }
  }
}

type HistoryEntryLinkProps = Pick<
  ComponentProps<typeof Link>,
  | 'accessibilityActions'
  | 'accessibilityLabel'
  | 'className'
  | 'onAccessibilityAction'
  | 'onLongPress'
> & {
  item: HistoryItem
  children: ReactNode
}

export const HistoryEntryLink = ({ item, ...props }: HistoryEntryLinkProps) => {
  switch (item.type) {
    case 'verse': {
      const bookNumber = Number(item.book)
      return (
        <Link
          {...props}
          route="BibleView"
          params={{
            contextDisplayMode: 'fullChapter',
            book: getBook(bookNumber) || getBook(1)!,
            chapter: Number(item.chapter),
            verse: Number(item.verse),
            version: item.version as VersionCode,
          }}
        />
      )
    }
    case 'strong':
      return (
        <Link
          {...props}
          route="Strong"
          params={{ book: item.book, reference: getHistoryStrongReference(item) ?? '' }}
        />
      )
    case 'word':
      return (
        <Link
          {...props}
          route="DictionnaryDetail"
          params={{
            word: item.word,
            entryId: item.entryId,
            correspondenceId: item.correspondenceId,
            work: item.work,
            resourceId: item.resourceId,
            dictionaryTitle: item.dictionaryTitle,
            language: item.language,
          }}
        />
      )
    case 'nave':
      return (
        <Link
          {...props}
          route="NaveDetail"
          params={{ name: item.name, name_lower: item.name_lower }}
        />
      )
    case 'study':
      return <Link {...props} route="EditStudy" params={{ studyId: item.studyId }} />
    case 'note':
      return <Link {...props} route="Note" params={{ noteId: item.noteId }} />
    case 'plan':
      return <Link {...props} route="Plan" params={{ planId: item.planId }} />
    case 'meditation':
      return (
        <Link
          {...props}
          route="Meditation"
          params={{
            collectionId: item.collectionId,
            readingId: item.readingId,
            date: item.readingDate,
          }}
        />
      )
    case 'timeline':
      return <Link {...props} route="Event" params={{ slug: item.slug, language: item.language }} />
    case 'commentary':
      return <Link {...props} route="Commentaries" params={{ verse: item.verse }} />
    case 'commentary-resource':
      return item.sectionId ? (
        <Link
          {...props}
          route="CommentaryEntry"
          params={{
            projectionId: item.projectionId,
            book: item.book,
            chapter: item.chapter,
            sectionId: item.sectionId,
          }}
        />
      ) : (
        <Link
          {...props}
          route="CommentaryChapter"
          params={{ projectionId: item.projectionId, book: item.book, chapter: item.chapter }}
        />
      )
  }
}
