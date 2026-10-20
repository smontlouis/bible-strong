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
import type { NoteListRow } from '~features/entityListQuery/noteListRows'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'

const NoteLink = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('pl-[20px] pt-[16px]', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const collapseWhitespace = (text?: string) => text?.replace(/\s+/g, ' ').trim() ?? ''

type Props = {
  item: NoteListRow
  onPress: (noteId: string) => void
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
  // A preview reads as running text: the note's line breaks would only leave blank lines.
  const noteTitle = collapseWhitespace(item.note.title)
  const noteDescription = collapseWhitespace(item.note.description)
  const showDescription = !!noteDescription && noteDescription !== noteTitle

  const hasChips = Boolean(Object.keys(item.note.tags || {}).length || relationCount)

  return (
    <Box className="overflow-hidden border-continuous">
      <Box className="overflow-hidden border-continuous flex-row items-start">
        <Box className="overflow-hidden border-continuous flex-[1]">
          <NoteLink
            onPress={() => onPress(item.noteId)}
            style={{ paddingBottom: hasChips ? 0 : 16 }}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center">
              {item.isAnnotation && (
                <Box className="overflow-hidden border-continuous rounded-[4px] bg-light-primary px-[5px] py-[1px] mr-[6px]">
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.5px] text-primary">
                    {t('Annotation')}
                  </Text>
                </Box>
              )}
              <Text className="flex-[1] text-[12px] text-dark-grey" numberOfLines={1}>
                {!!item.passage && (
                  <Text className="text-[12px] font-semibold text-grey">{item.passage}</Text>
                )}
                {item.passage ? ` · ${relativeDate}` : relativeDate}
              </Text>
            </Box>
            {!!noteTitle && (
              <Text
                className="mt-[6px] text-[16px] leading-[22px]"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
              >
                {noteTitle}
              </Text>
            )}
            {showDescription && (
              <Text
                className={twMerge(
                  'text-[14px] leading-[20px] text-grey',
                  noteTitle ? 'mt-[2px]' : 'mt-[6px]'
                )}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {noteDescription}
              </Text>
            )}
          </NoteLink>
          {hasChips && (
            <Box className="overflow-hidden border-continuous pl-[20px] pt-[5px] pb-[16px]">
              <EntityChipList
                tags={item.note.tags}
                relationCount={relationCount}
                onRelationPress={onRelationPress}
              />
            </Box>
          )}
        </Box>
        {/* The 54pt trigger centres its icon on the header line. */}
        <Box className="overflow-hidden border-continuous mt-[-3px] mr-[4px]">
          <NoteOptionsPanel noteId={item.noteId} title={item.title} />
        </Box>
      </Box>
      <Border className="mx-[20px]" />
    </Box>
  )
}
export default BibleNoteItem
