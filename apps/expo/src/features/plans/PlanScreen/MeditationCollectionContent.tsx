import { useCollectionChoice } from '~features/daily-reading/useCollectionChoice'
import { useRef, useState } from 'react'
import { Image } from 'expo-image'
import { useFireStorage } from '../plan.hooks'
import { useRouter } from 'expo-router'
import { Platform, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ComputedPlan, ComputedReadingSlice, Plan } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { getMeditationDateKey, getMeditationTitle, toCivilDate } from '../readingCalendar'

interface Props {
  plan: ComputedPlan
  onReadingSlicePress?: (
    slice: ComputedReadingSlice & {
      planId: string
      planTitle: string
      planLanguage?: Plan['lang']
      meditationDate?: string
    }
  ) => void
}

/** Calendar browsing and old completion marks share stable reading IDs, never inferred years. */
const MeditationCollectionContent = ({ plan, onReadingSlicePress }: Props) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { choose, pending, error, selected: isChosen } = useCollectionChoice(plan)
  const [width, setWidth] = useState(0)
  const desktop = Platform.OS === 'web' && width >= 900
  const today = useLocalReadingDate()
  const cover = useFireStorage(plan.image)
  const scroll = useRef<ScrollView>(null)
  const columnY = useRef(0)
  const listY = useRef(0)
  const rowY = useRef<Record<string, number>>({})
  const pendingToday = useRef(false)
  const revealToday = () => {
    const y = rowY.current[today.slice(5)]
    if (pendingToday.current && y !== undefined) {
      scroll.current?.scrollTo({
        y: Math.max(0, columnY.current + listY.current + y - 24),
        animated: true,
      })
      pendingToday.current = false
    }
  }
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  const date = chosenDate ?? today
  const all = plan.sections.flatMap(section => section.data)
  const readings = all.filter(
    reading => getMeditationDateKey(reading)?.slice(0, 2) === date.slice(5, 7)
  )
  const monthLabel = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  })
  const shortMonth = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
    month: 'short',
  })
  const moveMonth = (offset: number) => {
    const current = new Date(`${date}T12:00:00`)
    rowY.current = {}
    setChosenDate(toCivilDate(new Date(current.getFullYear(), current.getMonth() + offset, 1, 12)))
  }
  const open = (reading: ComputedReadingSlice) => {
    const payload = {
      ...reading,
      planId: plan.id,
      planTitle: plan.title,
      planLanguage: plan.lang,
      meditationDate: getMeditationDateKey(reading)
        ? `${date.slice(0, 4)}-${getMeditationDateKey(reading)}`
        : undefined,
    }
    if (onReadingSlicePress) onReadingSlicePress(payload)
    else
      router.push({
        pathname: '/meditation',
        params: {
          collectionId: plan.id,
          readingId: reading.id,
          ...(getMeditationDateKey(reading)
            ? { date: `${date.slice(0, 4)}-${getMeditationDateKey(reading)}` }
            : {}),
        },
      })
  }
  return (
    <ScrollView
      ref={scroll}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={{ width: '100%', maxWidth: 1180, alignSelf: 'center' }}
    >
      <Box
        className={
          desktop
            ? 'flex-row items-start p-[32px] pb-[48px] gap-[40px]'
            : 'p-[20px] pb-[48px] gap-[24px]'
        }
      >
        <Box
          className={
            desktop
              ? 'w-[260px] shrink-0 gap-[24px] pr-[28px] border-r border-border'
              : 'flex-row items-start gap-[20px] pb-[24px] border-b border-border'
          }
        >
          <Box
            className="rounded-[10px] overflow-hidden bg-light-grey"
            style={{ width: desktop ? 204 : 80, height: desktop ? 286 : 112 }}
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <Box className="flex-1 items-center justify-center">
                <FeatherIcon name="book-open" color="primary" size={28} />
              </Box>
            )}
          </Box>
          <Box className={desktop ? 'gap-[12px]' : 'flex-1 gap-[8px]'}>
            <Text className="text-default font-bold text-[22px] leading-[28px]">{plan.title}</Text>
            {plan.author.displayName !== plan.title && (
              <Text className="text-grey text-[14px]">{plan.author.displayName}</Text>
            )}
            <Box className="self-start mt-[8px]">
              <Button
                small
                reverse
                style={{ gap: 8, paddingHorizontal: 12, ...(isChosen ? { opacity: 1 } : {}) }}
                leftIcon={
                  <FeatherIcon name={isChosen ? 'check' : 'sun'} size={16} color="primary" />
                }
                onPress={() => {
                  void choose()
                }}
                isLoading={pending}
                disabled={pending || isChosen}
              >
                {t(isChosen ? 'dailyReading.collectionSelected' : 'dailyReading.dailyMeditation')}
              </Button>
              {error && (
                <Text accessibilityRole="alert" className="text-grey text-[13px] mt-[8px]">
                  {t('dailyReading.downloadError')}
                </Text>
              )}
            </Box>
          </Box>
        </Box>
        <Box
          className="flex-1 min-w-0 gap-[24px] w-full"
          onLayout={event => {
            columnY.current = event.nativeEvent.layout.y
          }}
        >
          <Box className="gap-[12px]">
            <Box className="flex-row items-center justify-between gap-[12px]">
              <Box className="flex-1 flex-row items-center gap-[12px]">
                <Link
                  size={36}
                  hitSlop={4}
                  className="bg-light-grey rounded-[18px]"
                  accessibilityLabel={t('dailyReading.previousMonth')}
                  onPress={() => moveMonth(-1)}
                >
                  <FeatherIcon name="chevron-left" size={20} color="primary" />
                </Link>
                <Text className="text-default font-bold text-[16px] flex-1 text-center">
                  {monthLabel}
                </Text>
                <Link
                  size={36}
                  hitSlop={4}
                  className="bg-light-grey rounded-[18px]"
                  accessibilityLabel={t('dailyReading.nextMonth')}
                  onPress={() => moveMonth(1)}
                >
                  <FeatherIcon name="chevron-right" size={20} color="primary" />
                </Link>
              </Box>
              <Link
                accessibilityLabel={t('dailyReading.today')}
                onPress={() => {
                  pendingToday.current = true
                  if (date.slice(0, 7) !== today.slice(0, 7)) rowY.current = {}
                  setChosenDate(today)
                  revealToday()
                }}
              >
                <Box className="min-h-[44px] justify-center">
                  <Text className="text-primary font-bold text-[14px]">
                    {t('dailyReading.today')}
                  </Text>
                </Box>
              </Link>
            </Box>
          </Box>
          <Box
            onLayout={event => {
              listY.current = event.nativeEvent.layout.y
              revealToday()
            }}
          >
            {readings.map(reading => {
              const key = getMeditationDateKey(reading)
              const selected = key === today.slice(5) && date.slice(0, 4) === today.slice(0, 4)
              const isToday = key === today.slice(5) && date.slice(0, 4) === today.slice(0, 4)
              return (
                <Box
                  key={reading.id}
                  onLayout={event => {
                    if (key) rowY.current[key] = event.nativeEvent.layout.y
                    revealToday()
                  }}
                >
                  <Link onPress={() => open(reading)} accessibilityRole="button">
                    <Box
                      className={`min-h-[68px] flex-row items-center gap-[16px] px-[12px] py-[14px] ${selected ? 'bg-light-grey rounded-[14px]' : 'border-b border-border'}`}
                    >
                      {key && (
                        <Box className="w-[38px] gap-[2px]">
                          <Text
                            className={`${selected ? 'text-primary' : 'text-default'} font-bold text-[19px]`}
                          >
                            {Number(key.slice(3))}
                          </Text>
                          <Text
                            className={`${selected ? 'text-primary' : 'text-grey'} text-[12px]`}
                          >
                            {shortMonth}
                          </Text>
                        </Box>
                      )}
                      <Box className="flex-1 gap-[6px]">
                        {isToday && (
                          <Box className="self-start bg-light-primary rounded-[8px] px-[8px] py-[3px]">
                            <Text className="text-primary text-[10px] font-bold uppercase">
                              {t('dailyReading.today')}
                            </Text>
                          </Box>
                        )}
                        <Text className="text-default text-[16px]">
                          {getMeditationTitle(reading)}
                        </Text>
                        {reading.status === 'Completed' && (
                          <Text className="text-grey text-[12px]">
                            {t('dailyReading.previouslyRead')}
                          </Text>
                        )}
                      </Box>
                      <FeatherIcon name="chevron-right" size={18} color="primary" />
                    </Box>
                  </Link>
                </Box>
              )
            })}
            {!readings.length && <Text className="text-grey">{t('dailyReading.noEntry')}</Text>}
          </Box>
        </Box>
      </Box>
    </ScrollView>
  )
}

export default MeditationCollectionContent
