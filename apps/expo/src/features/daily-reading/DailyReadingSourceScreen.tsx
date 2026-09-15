import { useCollectionChoice } from './useCollectionChoice'
import { Image } from 'expo-image'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, SectionList } from 'react-native'
import FiltersHeader from '~common/FiltersHeader'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import Link from '~common/Link'
import type { OnlinePlan } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import Text from '~common/ui/Text'
import { useFireStorage } from '~features/plans/plan.hooks'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { fetchPlans } from '~redux/modules/plan'
import { setDailyMeditation } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import { selectSortedOnlinePlans } from '~redux/selectors/plan'
import type { AppDispatch } from '~redux/store'

const CollectionCard = ({
  collection,
  selected,
  onPress,
}: {
  collection: OnlinePlan
  selected: boolean
  onPress: () => void
}) => {
  const image = useFireStorage(collection.image)
  const { t } = useTranslation()
  const { choose, pending, error } = useCollectionChoice(collection)
  return (
    <Box className="bg-reverse border-b border-border px-[16px] py-[10px]">
      <Box className="flex-row items-center gap-[8px]">
        <Link
          onPress={onPress}
          accessibilityLabel={collection.title}
          accessibilityHint={t('dailyReading.browseCollection')}
          className="flex-1 flex-row items-center gap-[12px]"
        >
          <Box className="bg-light-grey rounded-[8px] overflow-hidden w-[44px] h-[44px]">
            {image ? (
              <Image
                source={{ uri: image }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <Box className="flex-1 items-center justify-center">
                <FeatherIcon name="book-open" size={24} color="primary" />
              </Box>
            )}
          </Box>
          <Box className="flex-1 gap-[3px]">
            <Text className="text-default text-[16px]">{collection.title}</Text>
            {collection.author?.displayName &&
              collection.author.displayName !== collection.title && (
                <Text className="text-grey text-[12px]">{collection.author.displayName}</Text>
              )}
          </Box>
        </Link>
        <Link
          size={44}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected, disabled: pending }}
          accessibilityLabel={`${t('dailyReading.choose')}: ${collection.title}`}
          disabled={pending}
          onPress={() => {
            if (!selected) void choose()
          }}
        >
          {pending ? (
            <ActivityIndicator />
          ) : (
            <FeatherIcon
              name={selected ? 'check-circle' : 'circle'}
              color={selected ? 'primary' : 'grey'}
              size={22}
            />
          )}
        </Link>
      </Box>
      {error && (
        <Text accessibilityRole="alert" className="text-grey mt-[8px]">
          {t('dailyReading.downloadError')}
        </Text>
      )}
    </Box>
  )
}

type SourceItem =
  | { id: 'standalone'; kind: 'standalone' }
  | { id: string; kind: 'collection'; collection: OnlinePlan }

const DailyReadingSourceScreen = ({ embedded = false }: { embedded?: boolean }) => {
  const Layout = embedded ? Box : Container
  const { t } = useTranslation()
  const router = useRouter()
  const { collectionId } = useLocalSearchParams<{ collectionId?: string }>()
  const dispatch = useDispatch<AppDispatch>()
  const [lang, setLang] = useState<'all' | 'fr' | 'en'>('all')
  const selectedId = useSelector((state: RootState) => state.user.bible.settings.dailyMeditationId)
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const online = useSelector(selectSortedOnlinePlans)
  const local = useSelector((state: RootState) => state.plan.myPlans)
  const collections = [
    ...online,
    ...local.filter(plan => !online.some(item => item.id === plan.id)),
  ].filter(plan => getEditorialKind(plan) === 'daily-meditation')

  const filters = [
    {
      key: 'language',
      icon: 'globe' as const,
      label: t('menu.language'),
      value: t(lang === 'all' ? 'Tous' : lang === 'fr' ? 'Français' : 'Anglais'),
      active: lang !== 'all',
      onPress: () => {},
      options: (['all', 'fr', 'en'] as const).map(value => ({
        key: value,
        label: t(value === 'all' ? 'Tous' : value === 'fr' ? 'Français' : 'Anglais'),
        selected: lang === value,
        onSelect: () => setLang(value),
      })),
    },
  ]

  useEffect(() => {
    dispatch(fetchPlans())
  }, [dispatch])

  const sections: { key: string; title?: string; data: SourceItem[] }[] = [
    { key: 'standalone', data: [{ id: 'standalone', kind: 'standalone' }] },
    ...(['fr', 'en'] as const)
      .filter(language => lang === 'all' || lang === language)
      .map(language => ({
        key: language,
        title: t(language === 'fr' ? 'Français' : 'Anglais'),
        data: collections
          .filter(collection => collection.lang === language)
          .map(collection => ({ id: collection.id, kind: 'collection' as const, collection })),
      }))
      .filter(section => section.data.length > 0),
  ]

  if (collectionId)
    return <Redirect href={{ pathname: '/meditation-collection', params: { collectionId } }} />

  return (
    <Layout className="flex-1">
      {!embedded && (
        <Header
          hasBackButton
          title={t('dailyReading.title')}
          rightComponent={
            <FiltersHeader
              title={t('dailyReading.collections')}
              buttonOnly
              filters={filters}
              onReset={() => setLang('all')}
            />
          }
        />
      )}
      {embedded && (
        <Box className="flex-row justify-end px-[20px]">
          <FiltersHeader
            title={t('dailyReading.collections')}
            buttonOnly
            filters={filters}
            onReset={() => setLang('all')}
          />
        </Box>
      )}
      <SectionList<SourceItem>
        style={{ flex: 1 }}
        contentContainerStyle={[pageContentStyle, { paddingBottom: 24 }]}
        sections={sections}
        stickySectionHeadersEnabled
        keyExtractor={item => item.id}
        initialNumToRender={24}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Box className="min-h-[40px] px-[16px] justify-center bg-light-grey border-b border-border">
              <Text accessibilityRole="header" className="text-grey text-[14px] font-bold">
                {section.title}
              </Text>
            </Box>
          ) : null
        }
        renderItem={({ item }) =>
          item.kind === 'standalone' ? (
            <Link
              accessibilityRole="radio"
              accessibilityState={{ checked: !selectedId }}
              onPress={() => dispatch(setDailyMeditation(null))}
              className="flex-row items-center bg-reverse border-b border-border px-[16px] py-[10px] gap-[12px] min-h-[64px]"
            >
              <Box className="bg-light-grey rounded-[8px] w-[44px] h-[44px] items-center justify-center">
                <FeatherIcon name="sun" size={22} color="primary" />
              </Box>
              <Text className="text-default text-[16px] flex-1">{t('dailyReading.default')}</Text>
              <Box className="w-[44px] h-[44px] items-center justify-center">
                <FeatherIcon
                  name={!selectedId ? 'check-circle' : 'circle'}
                  color={!selectedId ? 'primary' : 'grey'}
                  size={22}
                />
              </Box>
            </Link>
          ) : (
            <CollectionCard
              collection={item.collection}
              selected={selectedId === item.id}
              onPress={() =>
                router.push({
                  pathname: '/meditation-collection',
                  params: { collectionId: item.id },
                })
              }
            />
          )
        }
        ListFooterComponent={
          status === 'Pending' && !collections.length ? (
            <Box className="p-[16px]">
              <ActivityIndicator accessibilityLabel={t('Chargement...')} />
            </Box>
          ) : status === 'Rejected' ? (
            <Box className="p-[16px] gap-[8px]">
              <Text className="text-grey">{t('dailyReading.catalogError')}</Text>
              <Button reverse onPress={() => dispatch(fetchPlans())}>
                {t('dailyReading.retry')}
              </Button>
            </Box>
          ) : null
        }
      />
    </Layout>
  )
}

export default DailyReadingSourceScreen
