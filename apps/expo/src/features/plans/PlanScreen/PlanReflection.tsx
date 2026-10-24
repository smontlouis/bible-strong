import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { useOpenNote } from '~features/notes/useOpenNote'
import type { RootState } from '~redux/modules/reducer'
import { makeNotesForVerseSelector } from '~redux/selectors/bible'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'

const ROW = 'px-[16px] py-[14px]'
const selectNotesForVerse = makeNotesForVerseSelector()

/**
 * The day's reflection: the reader's notes on the first verse of the day, and a way to write
 * one. A reflection is a note like any other, found again on that verse in the Bible.
 */
const PlanReflection = ({ verseKey, reference }: { verseKey: string; reference: string }) => {
  const { t } = useTranslation()
  const openNote = useOpenNote()
  const version = useDefaultBibleVersion()
  const notes = useSelector((state: RootState) => selectNotesForVerse(state, verseKey)).filter(
    note => !note.isAnnotationNote
  )
  return (
    <Box>
      <ListSectionTitle>{t('readingPlans.reflection')}</ListSectionTitle>
      <Card>
        {notes.map((note, index) => (
          <Box key={note.id}>
            {index > 0 && <ListSeparator inset={16} />}
            <Link
              accessibilityRole="link"
              accessibilityLabel={note.title || note.description}
              className={`${ROW} gap-[4px]`}
              onPress={() => openNote({ noteId: note.id })}
            >
              {!!note.title && (
                <Text className="text-default font-bold text-[15px]" numberOfLines={1}>
                  {note.title}
                </Text>
              )}
              {!!note.description && (
                <Text className="text-grey text-[14px] leading-[20px]" numberOfLines={3}>
                  {note.description}
                </Text>
              )}
            </Link>
          </Box>
        ))}
        {notes.length > 0 && <ListSeparator inset={16} />}
        <Link
          accessibilityRole="button"
          accessibilityLabel={t('readingPlans.writeReflection')}
          accessibilityHint={reference}
          className={`${ROW} flex-row items-center gap-[12px]`}
          onPress={() => openNote({ verseKeys: [verseKey], version })}
        >
          <FeatherIcon name="edit-3" size={18} color="primary" />
          <Box className="flex-1 gap-[2px]">
            <Text className="text-link font-bold text-[15px]">
              {t('readingPlans.writeReflection')}
            </Text>
            <Text className="text-grey text-[12px]">{reference}</Text>
          </Box>
        </Link>
      </Card>
    </Box>
  )
}

export default PlanReflection
