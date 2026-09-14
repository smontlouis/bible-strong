import { useCollectionChoice } from './useCollectionChoice'
import { Image } from 'expo-image'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
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
    <Box className="bg-reverse rounded-[20px] p-[12px] mb-[12px]">
      <Box className="flex-row items-center gap-[8px]">
        <Link
          onPress={onPress}
          accessibilityLabel={collection.title}
          accessibilityHint={t('dailyReading.browseCollection')}
          className="flex-1 flex-row items-center gap-[16px]"
        >
          <Box className="bg-light-grey rounded-[12px] overflow-hidden w-[72px] h-[72px]">
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
          <Box className="flex-1 gap-[5px]">
            <Text className="text-default font-bold text-[16px]">{collection.title}</Text>
            <Text className="text-grey text-[13px]">{collection.author?.displayName}</Text>
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
      <ScrollView contentContainerStyle={[pageContentStyle, { padding: 24, paddingBottom: 48 }]}>
        <>
          <Text className="text-default text-[28px] font-bold mb-[12px]">
            {t('dailyReading.heading')}
          </Text>
          <Text className="text-grey text-[15px] leading-[24px] mb-[24px]">
            {t('dailyReading.description')}
          </Text>
          <Link
            accessibilityRole="radio"
            accessibilityState={{ checked: !selectedId }}
            onPress={() => dispatch(setDailyMeditation(null))}
            className="flex-row items-center bg-reverse rounded-[24px] p-[20px] gap-[16px] mb-[32px]"
          >
            <Box className="bg-light-grey rounded-[16px] p-[14px]">
              <FeatherIcon name="sun" size={24} color="primary" />
            </Box>
            <Box className="flex-1 gap-[5px]">
              <Text className="text-default font-bold text-[16px]">
                {t('dailyReading.default')}
              </Text>
              <Text className="text-grey text-[13px]">{t('dailyReading.defaultDescription')}</Text>
            </Box>
            <FeatherIcon
              name={!selectedId ? 'check-circle' : 'circle'}
              color={!selectedId ? 'primary' : 'grey'}
              size={22}
            />
          </Link>
          {status === 'Pending' && !collections.length && (
            <ActivityIndicator accessibilityLabel={t('Chargement...')} />
          )}
          {status === 'Rejected' && (
            <Box className="gap-[12px] mb-[20px]">
              <Text className="text-grey">{t('dailyReading.catalogError')}</Text>
              <Button reverse onPress={() => dispatch(fetchPlans())}>
                {t('dailyReading.retry')}
              </Button>
            </Box>
          )}
          {(['fr', 'en'] as const)
            .filter(value => lang === 'all' || lang === value)
            .map(value => {
              const entries = collections.filter(collection => collection.lang === value)
              if (!entries.length) return null
              return (
                <Box key={value} className="mb-[24px]">
                  <Text
                    accessibilityRole="header"
                    className="text-default font-bold text-[18px] mb-[16px]"
                  >
                    {t(value === 'fr' ? 'Français' : 'Anglais')}
                  </Text>
                  {entries.map(collection => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      selected={selectedId === collection.id}
                      onPress={() =>
                        router.push({
                          pathname: '/meditation-collection',
                          params: { collectionId: collection.id },
                        })
                      }
                    />
                  ))}
                </Box>
              )
            })}
        </>
      </ScrollView>
    </Layout>
  )
}

export default DailyReadingSourceScreen
