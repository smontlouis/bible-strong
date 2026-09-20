import NoteOptionsPanel from '~features/notes/NoteOptionsPanel'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, Theme } from '~themes/ThemeProvider'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import EntityChipList from '~common/EntityChipList'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { useTranslation } from 'react-i18next'
import Paragraph from '~common/ui/Paragraph'
import type { NoteListRow } from '~features/entityListQuery/noteListRows'
import { getDateLocale } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'

const NoteLink = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('py-[20px] p-[20px] pr-[0px] flex-row', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

type Props = {
  item: NoteListRow
  onPress: (noteId: string) => void
  onMenuPress: (noteId: string) => void
  relationCount?: number
  onRelationPress?: () => void
}

const BibleNoteItem = ({ item, onPress, relationCount, onRelationPress }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const formattedDate = distanceInWords(Number(item.note.date), mountTime, {
    locale: getDateLocale(lang),
  })
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const metadataLabel = item.reference ? `${item.reference} - ${relativeDate}` : relativeDate
  const noteTitle = item.note.title?.trim() ?? ''
  const noteDescription = item.note.description?.trim() ?? ''

  const hasChips = Boolean(Object.keys(item.note.tags || {}).length || relationCount)

  return (
    <Box className="overflow-hidden border-continuous">
      <Box className="overflow-hidden border-continuous flex-row items-center">
        <Box className="overflow-hidden border-continuous flex-[1]">
          <NoteLink
            onPress={() => onPress(item.noteId)}
            style={{ paddingBottom: hasChips ? 8 : 20 }}
          >
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Text className="text-dark-grey font-bold text-[11px]">{metadataLabel}</Text>
              {!!noteTitle && (
                <Text
                  className="text-[17px]"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                >
                  {noteTitle}
                </Text>
              )}
              {!!noteDescription && noteDescription !== noteTitle && (
                <Paragraph scale={-1} scaleLineHeight={-1}>
                  {truncate(noteDescription, 100)}
                </Paragraph>
              )}
            </Box>
          </NoteLink>
          {hasChips && (
            <Box className="overflow-hidden border-continuous px-[20px] pb-[20px]">
              <EntityChipList
                tags={item.note.tags}
                relationCount={relationCount}
                onRelationPress={onRelationPress}
              />
            </Box>
          )}
        </Box>
        <NoteOptionsPanel noteId={item.noteId} title={item.title} />
      </Box>
      <Border className="mx-[20px]" />
    </Box>
  )
}
export default BibleNoteItem
