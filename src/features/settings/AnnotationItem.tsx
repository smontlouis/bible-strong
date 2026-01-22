import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import distanceInWords from 'date-fns/formatDistance'
import styled from '@emotion/native'

import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { LinkBox } from '~common/Link'
import HighlightTypeIndicator from '~common/HighlightTypeIndicator'
import TagList from '~common/TagList'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import formatVerseContent from '~helpers/formatVerseContent'
import { useResolvedColor } from '~helpers/useHighlightColors'
import books from '~assets/bible_versions/books-desc'
import type { GroupedWordAnnotation } from '~redux/selectors/bible'
import type { TagsObj } from '~common/types'
import { Chip } from '~common/ui/NewChip'

const DateText = styled.Text(({ theme }) => ({
  color: theme.colors.tertiary,
}))

const AnnotationContainer = styled(Box)(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
}))

export type AnnotationItemProps = {
  item: GroupedWordAnnotation
  onSettingsPress: (item: GroupedWordAnnotation) => void
}

const AnnotationItem = ({ item, onSettingsPress }: AnnotationItemProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const lang = useLanguage()

  const resolvedColor = useResolvedColor(item.color)

  const [Livre, Chapitre, Verset] = item.verseKey.split('-').map(Number)
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: getDateLocale(lang),
  })

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(books[Livre - 1]),
            chapter: String(Chapitre),
            verse: String(Verset),
            version: item.version,
            focusVerses: JSON.stringify([Verset]),
          },
        })
      }
    >
      <AnnotationContainer>
        <Box row style={{ marginBottom: 10 }} alignItems="center">
          <HStack flex row alignItems="center" gap={10}>
            <HStack>
              <HighlightTypeIndicator
                color={resolvedColor}
                type={item.type as 'background' | 'underline'}
                size={15}
              />
              <Text fontSize={14} marginLeft={10} title>
                {title}
              </Text>
            </HStack>

            <Chip>{item.version}</Chip>
          </HStack>
          <DateText style={{ fontSize: 10 }}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </DateText>
          <LinkBox
            p={4}
            ml={10}
            // @ts-ignore
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => onSettingsPress(item)}
          >
            <FeatherIcon name="more-vertical" size={20} />
          </LinkBox>
        </Box>
        <Text fontSize={14} marginBottom={15}>
          {`...${item.text}...`}
        </Text>
        {item.tags && Object.keys(item.tags).length > 0 && <TagList tags={item.tags as TagsObj} />}
      </AnnotationContainer>
    </TouchableOpacity>
  )
}

export default AnnotationItem
