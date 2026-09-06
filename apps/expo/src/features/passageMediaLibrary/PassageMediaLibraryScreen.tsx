import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from '~common/ui/PageContent'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SectionList, useWindowDimensions } from 'react-native'
import Header from '~common/Header'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  getPassageMediaLibrary,
  type ResolvedPassageMediaLibraryItem,
} from '~features/bible/passageMedia'
import useLanguage from '~helpers/useLanguage'
import PassageMediaLibraryCard from './PassageMediaLibraryCard'
// Editorial order of the 19 episodes published in BibleProject's
// "How to Read the Bible" collection.
const HOW_TO_READ_THE_BIBLE_WORK_IDS = [
  'associated-resource-ak06MSETeo4',
  'associated-resource-7_CGP-12AE0',
  'associated-resource-ebI_4ZxcAMk',
  'associated-resource-VhmlJBUIoLk',
  'associated-resource-FqXKc81z7Oc',
  'associated-resource-0EQDGax19xk',
  'associated-resource-7FuT8WtoAK0',
  'associated-resource-j5qdaWO9wp8',
  'associated-resource-IQhUpoYAnKQ',
  'associated-resource-L9W5afjndtU',
  'associated-resource-dpny22k_7uk',
  'associated-resource-QmrpB52gWwM',
  'associated-resource-Sew1kBIe-W0',
  'associated-resource-WJgt1vRkPbI',
  'associated-resource-L0-8nUbfW5w',
  'associated-resource-IT3LVWWuDDo',
  'associated-resource-GZuceW7eh5M',
  'associated-resource-ZPZ2uABVMKA',
  'associated-resource-Tn09RdxfqbM',
] as const

const HOW_TO_READ_THE_BIBLE_ORDER = new Map<string, number>(
  HOW_TO_READ_THE_BIBLE_WORK_IDS.map((workId, index) => [workId, index])
)

type LibrarySection = {
  title: string
  data: ResolvedPassageMediaLibraryItem[]
}

const getHowToReadTheBibleEpisodes = (items: ResolvedPassageMediaLibraryItem[]) =>
  items
    .filter(item => HOW_TO_READ_THE_BIBLE_ORDER.has(item.workId))
    .sort(
      (left, right) =>
        (HOW_TO_READ_THE_BIBLE_ORDER.get(left.workId) ?? Number.MAX_SAFE_INTEGER) -
        (HOW_TO_READ_THE_BIBLE_ORDER.get(right.workId) ?? Number.MAX_SAFE_INTEGER)
    )

const PassageMediaLibraryScreen = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const router = useRouter()
  const language = useLanguage()
  const { width: windowWidth } = useWindowDimensions()
  const episodes = getHowToReadTheBibleEpisodes(getPassageMediaLibrary({ language }))
  const contentWidth = Math.min(windowWidth, 760)
  const thumbnailWidth = Math.min(176, Math.max(128, (contentWidth - 40) * 0.38))
  const sections: LibrarySection[] = episodes.length
    ? [
        {
          title: t('passageMediaLibrary.categories.how-to-read'),
          data: episodes,
        },
      ]
    : []

  const playVideo = (item: ResolvedPassageMediaLibraryItem) => {
    router.push({
      pathname: '/(explore)/passage-media-player',
      params: { workId: item.workId },
    })
  }

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton background title={t('passageMediaLibrary.title')} />
      <SectionList
        sections={sections}
        keyExtractor={item => item.editionId}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          pageContentStyle,
          {
            width: '100%',
            maxWidth: contentWidth,
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 48,
          },
        ]}
        ListHeaderComponent={
          <VStack className="overflow-hidden border-continuous mb-[22px] gap-[5px]">
            <Text
              className="text-[25px] leading-[31px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {t('passageMediaLibrary.heading')}
            </Text>
            <Text
              className="text-grey text-[15px] leading-[21px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
            >
              {t('passageMediaLibrary.subtitle')}
            </Text>
          </VStack>
        }
        renderSectionHeader={({ section }) => (
          <Box className="overflow-hidden border-continuous bg-reverse pt-[30px] pb-[20px]">
            <Text
              className="text-[19px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {section.title}
            </Text>
          </Box>
        )}
        renderItem={({ item, index }) => (
          <PassageMediaLibraryCard
            item={item}
            episodeNumber={index + 1}
            thumbnailWidth={thumbnailWidth}
            onPress={() => playVideo(item)}
          />
        )}
        ListEmptyComponent={
          <Box className="overflow-hidden border-continuous py-[60px] items-center justify-center">
            <Text className="text-grey text-center">{t('passageMediaLibrary.empty')}</Text>
          </Box>
        }
      />
    </SafeAreaBox>
  )
}

export default PassageMediaLibraryScreen
