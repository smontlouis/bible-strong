import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import HighlightOptions from '~common/HighlightOptions'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'

import EntityChipList from '~common/EntityChipList'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import type { TagsObj, Verse, VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResolvedBibleVerses } from '~features/resources/useBibleVerses'
import { getBook } from '~helpers/bibleBookCatalog'
import formatVerseContent from '~helpers/formatVerseContent'
import { getDateLocale } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import { useHighlightColors, useResolvedColor } from '~helpers/useHighlightColors'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'
import { removeBreakLines } from '~helpers/utils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { CustomColor, HighlightType } from '~redux/modules/user'

const DateText = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-tertiary', className)
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.Text>['style']}
    />
  )
}

const Container = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'm-[20px] pb-[20px] mb-[0px] border-b-border border-b-[1px]',
    className
  )
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export type HighlightSettingsData = {
  stringIds: VerseIds
  verseIds: Verse[]
  color: string
  date: number
  tags: TagsObj
  version?: string
}

type VerseComponentProps = Omit<HighlightSettingsData, 'stringIds'> & {
  stringIds?: VerseIds
  setSettings?: (settings: HighlightSettingsData) => void
}

const VerseComponent = ({
  color,
  date,
  verseIds,
  stringIds,
  tags,
  version: sourceVersion,
  setSettings,
}: VerseComponentProps) => {
  const stylingTheme = useStylingTheme()

  const pushRouteOnce = usePushRouteOnce()
  const { verses, version } = useResolvedBibleVerses(verseIds, sourceVersion)
  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const { customHighlightColors, defaultColorTypes } = useHighlightColors()
  const resolvedColor = useResolvedColor(color)

  // Resolve highlight type based on color ID
  const resolveHighlightType = (colorId: string): HighlightType => {
    // Default colors (color1, color2, etc.)
    if (colorId.startsWith('color')) {
      return defaultColorTypes[colorId as keyof typeof defaultColorTypes] || 'background'
    }
    // Custom colors
    const customColor = customHighlightColors.find((c: CustomColor) => c.id === colorId)
    return customColor?.type || 'background'
  }

  const highlightType = resolveHighlightType(color)

  const { title } = formatVerseContent(verseIds)
  const { content } = formatVerseContent(verses)
  const formattedDate = distanceInWords(Number(date), mountTime, {
    locale: getDateLocale(lang),
  })
  const { Livre, Chapitre, Verset } = verseIds[0]
  const bibleViewParams = {
    contextDisplayMode: 'focused',
    book: JSON.stringify(getBook(Number(Livre))),
    chapter: String(Chapitre),
    verse: String(Verset),
    focusVerses: JSON.stringify(verseIds.map(v => Number(v.Verset))),
    ...(version && { version }),
  }
  const openBibleView = () => {
    pushRouteOnce({
      pathname: '/bible-view',
      params: bibleViewParams,
    })
  }

  return (
    <Container>
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={openBibleView}>
        <Box
          className="overflow-hidden border-continuous flex-row pr-[32px] items-center"
          style={{ marginBottom: 10 }}
        >
          <Box className="overflow-hidden border-continuous flex-[1] flex-row items-center">
            <HighlightTypeIndicator color={resolvedColor} type={highlightType} size={15} />
            <Text
              className="text-[14px] ml-[10px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {title}
            </Text>
          </Box>
          <DateText style={{ fontSize: 10 }}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </DateText>
        </Box>
        <Paragraph className="mb-[15px]" scale={-2}>
          {content
            ? truncate(removeBreakLines(content), 200)
            : t('bibleVerse.textUnavailableInstalled')}
        </Paragraph>
      </TouchableOpacity>
      <EntityChipList tags={tags} />
      {setSettings && stringIds && <HighlightOptions verseIds={stringIds} color={color} />}
    </Container>
  )
}

export default VerseComponent
