import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useReadingTypography } from '~common/useReadingTypography'
import { makeNoteByKeySelector } from '~redux/selectors/bible'
import type { RootState } from '~redux/modules/reducer'

export default function NotePreviewContent({ noteId }: { noteId: string }) {
  const selectNote = makeNoteByKeySelector()
  const note = useSelector((state: RootState) => selectNote(state, noteId))
  const { t } = useTranslation()
  const typography = useReadingTypography()
  if (!note) return <Text className="text-grey text-[14px]">{t("Cette note n'existe plus")}</Text>
  return (
    <Box className="gap-[8px]">
      {!!note.title?.trim() && <Text className="font-semibold text-[16px]">{note.title}</Text>}
      <Text style={{ fontFamily: typography.fontFamily, fontSize: 16, lineHeight: 24 }}>
        {note.description}
      </Text>
    </Box>
  )
}
