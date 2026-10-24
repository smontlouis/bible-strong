import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, Text as NativeText } from 'react-native'
import HighlightOptions from '~common/HighlightOptions'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import EntityChipList from '~common/EntityChipList'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import type { TagsObj } from '~common/types'
import Border from '~common/ui/Border'
import Box, { HStack } from '~common/ui/Box'
import { Chip } from '~common/ui/NewChip'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import formatVerseContent from '~helpers/formatVerseContent'
import { getDateLocale } from '~helpers/languageUtils'
import { useResolvedColor } from '~helpers/useHighlightColors'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { GroupedWordAnnotation } from '~redux/selectors/bible'

const DateText = (
  componentProps: Omit<UIComponentProps<typeof NativeText>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-tertiary', className)
  return (
    <NativeText
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeText>['style']}
    />
  )
}

const AnnotationContainer = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('mx-[20px] mt-[20px] pb-[20px]', className)
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export type AnnotationItemProps = {
  item: GroupedWordAnnotation
  onSettingsPress?: (item: GroupedWordAnnotation) => void
}

const AnnotationItem = ({ item, onSettingsPress }: AnnotationItemProps) => {
  const stylingTheme = useStylingTheme()

  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const resolvedColor = useResolvedColor(item.color)

  const [Livre, Chapitre, Verset] = item.verseKey.split('-').map(Number)
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), mountTime, {
    locale: getDateLocale(lang),
  })
  const bibleViewParams = {
    contextDisplayMode: 'focused',
    book: JSON.stringify(getBook(Livre)),
    chapter: String(Chapitre),
    verse: String(Verset),
    version: item.version,
    focusVerses: JSON.stringify([Verset]),
  }
  const openBibleView = () => {
    pushRouteOnce({
      pathname: '/bible-view',
      params: bibleViewParams,
    })
  }

  return (
    <>
      <AnnotationContainer>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={openBibleView}>
          <Box
            className="overflow-hidden border-continuous flex-row pr-[32px] items-center"
            style={{ marginBottom: 10 }}
          >
            <HStack className="overflow-hidden border-continuous flex-[1] flex-row items-center gap-[10px]">
              <HStack className="overflow-hidden border-continuous">
                <HighlightTypeIndicator
                  color={resolvedColor}
                  type={item.type as 'background' | 'underline'}
                  size={15}
                />
                <Text className="text-[14px] ml-[10px]" style={titleFontStyle(stylingTheme)}>
                  {title}
                </Text>
              </HStack>

              <Chip className="rounded-full px-[7px]">{item.version}</Chip>
            </HStack>
            <DateText style={{ fontSize: 10 }}>
              {t('Il y a {{formattedDate}}', { formattedDate })}
            </DateText>
          </Box>
          <Paragraph className="mb-[15px]" scale={-2}>
            {`...${item.text}...`}
          </Paragraph>
        </TouchableOpacity>
        {item.tags && Object.keys(item.tags).length > 0 && (
          <EntityChipList tags={item.tags as TagsObj} />
        )}
        {onSettingsPress && <HighlightOptions annotationId={item.id} color={item.color} />}
      </AnnotationContainer>
      <Border className="ml-[20px]" />
    </>
  )
}

export default AnnotationItem
