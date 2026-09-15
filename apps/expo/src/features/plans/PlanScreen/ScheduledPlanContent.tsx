import ReadingDatePicker from '~features/daily-reading/ReadingDatePicker'
import { Image } from 'expo-image'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Platform, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { ComputedPlan, ComputedReadingSlice, Plan } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { startPlan, markAsRead } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import { useFireStorage } from '../plan.hooks'
import { getPlanDayDate, getScheduledPlanDay } from '../readingCalendar'
import { hasPlanParticipation, getPlanResumeDay } from '../planProgress'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'

interface Props {
  plan: ComputedPlan
  onReadingSlicePress?: (
    slice: ComputedReadingSlice & { planId: string; planTitle: string; planLanguage?: Plan['lang'] }
  ) => void
}

const ScheduledPlanContent = ({ plan, onReadingSlicePress }: Props) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const participation = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const started = hasPlanParticipation(participation)
  const [width, setWidth] = useState(0)
  const desktop = Platform.OS === 'web' && width >= 800
  const today = useLocalReadingDate()
  const params = useLocalSearchParams<{ date?: string }>()
  const [chosenDay, setChosenDay] = useState<number | null>(null)
  const readings = plan.sections.flatMap(section => section.data)
  const resumeDay = getPlanResumeDay(readings)
  const completed = readings.filter(item => item.status === 'Completed').length
  const scheduledDay = participation?.startDate
    ? getScheduledPlanDay(participation.startDate, today)
    : undefined
  const selectedDay = Math.max(
    1,
    Math.min(
      readings.length,
      chosenDay ??
        (participation?.startDate && params.date
          ? getScheduledPlanDay(participation.startDate, params.date)
          : undefined) ??
        (started ? resumeDay : 1)
    )
  )
  const reading = readings[selectedDay - 1]
  const selectedDate = participation?.startDate
    ? getPlanDayDate(participation.startDate, selectedDay)
    : undefined
  const missed = readings.filter(
    (item, index) => scheduledDay && index + 1 < scheduledDay && item.status !== 'Completed'
  )
  const cover = useFireStorage(plan.image)
  const formattedDate = (value: string) => {
    const current = new Date(`${value}T12:00:00`)
    const month = current.toLocaleDateString(i18n.language, { month: 'short' })
    return `${month}\n${current.getDate()}`
  }
  const openReading = (entry = reading) => {
    if (!entry) return
    const payload = { ...entry, planId: plan.id, planTitle: plan.title, planLanguage: plan.lang }
    if (onReadingSlicePress) onReadingSlicePress(payload)
    else
      router.push({
        pathname: '/plan-slice',
        params: { planId: plan.id, readingSliceId: entry.id },
      })
  }

  const visibleDays = Math.max(3, Math.min(7, Math.floor((width - (desktop ? 96 : 72)) / 72)))
  const windowStart = Math.max(
    0,
    Math.min(selectedDay - 1 - Math.floor(visibleDays / 2), readings.length - visibleDays)
  )
  const days = readings.slice(windowStart, windowStart + visibleDays)
  if (!readings.length)
    return (
      <Box className="p-[24px]">
        <Text className="text-grey">{t('dailyReading.noEntry')}</Text>
      </Box>
    )
  return (
    <ScrollView
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={[
        pageContentStyle,
        { maxWidth: 1000, padding: desktop ? 32 : 20, paddingBottom: 48 },
      ]}
    >
      <Box className="gap-[28px]">
        <Box className={desktop ? 'flex-row items-center gap-[24px]' : 'items-center gap-[16px]'}>
          {cover && (
            <Box
              className="bg-light-grey rounded-[18px] overflow-hidden"
              style={{ width: desktop ? 180 : 144, height: desktop ? 104 : 88 }}
            >
              <Image
                source={{ uri: cover }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
              />
            </Box>
          )}
          <Box className={desktop ? 'flex-1 gap-[12px]' : 'w-full items-center gap-[8px]'}>
            <Text className="text-default font-bold text-[26px]">{plan.title}</Text>
            <Text className="text-grey text-[14px]">{plan.author?.displayName}</Text>
            {started && (
              <Box className="flex-row items-center gap-[8px] mt-[8px]">
                <Box className="w-[50px] h-[6px] rounded-full bg-light-grey overflow-hidden">
                  <Box
                    className="h-full bg-primary"
                    style={{
                      width: `${readings.length ? (completed / readings.length) * 100 : 0}%`,
                    }}
                  />
                </Box>
                {completed === readings.length && (
                  <Text className="text-grey text-[12px]">{t('readingPlans.finished')}</Text>
                )}
              </Box>
            )}
          </Box>
        </Box>
        {!started && !!plan.description && (
          <Text className="text-default text-[15px] leading-[24px]">{plan.description}</Text>
        )}
        <Box className="bg-light-grey rounded-[24px] p-[16px] gap-[20px]">
          <Box className="flex-row items-center justify-between gap-[12px]">
            <Text className="text-default font-bold text-[18px]">
              {t('readingPlans.dayOfTotal', { day: selectedDay, total: readings.length })}
            </Text>
            <Box className="flex-row">
              <Link
                size={36}
                hitSlop={4}
                accessibilityLabel={t('dailyReading.previous')}
                disabled={selectedDay <= 1}
                onPress={() => setChosenDay(selectedDay - 1)}
              >
                <FeatherIcon
                  name="chevron-left"
                  size={20}
                  color={selectedDay <= 1 ? 'grey' : 'primary'}
                />
              </Link>
              <Link
                size={36}
                hitSlop={4}
                accessibilityLabel={t('dailyReading.next')}
                disabled={selectedDay >= readings.length}
                onPress={() => setChosenDay(selectedDay + 1)}
              >
                <FeatherIcon
                  name="chevron-right"
                  size={20}
                  color={selectedDay >= readings.length ? 'grey' : 'primary'}
                />
              </Link>
            </Box>
          </Box>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <Box className="flex-1 flex-row justify-between gap-[12px]">
              {days.map((item, index) => {
                const day = windowStart + index + 1
                const selected = day === selectedDay
                const done = item.status === 'Completed'
                const dayDate = participation?.startDate
                  ? getPlanDayDate(participation.startDate, day)
                  : undefined
                return (
                  <Link
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('readingPlans.day', { day })}${done ? `, ${t('readingPlans.dayCompleted')}` : ''}`}
                    accessibilityState={{ selected }}
                    onPress={() => setChosenDay(day)}
                  >
                    <Box className="items-center gap-[6px] w-[60px]">
                      <Box
                        className={`w-[40px] h-[40px] rounded-full items-center justify-center ${selected ? 'bg-primary' : done ? 'bg-success' : 'bg-reverse'}`}
                      >
                        {done ? (
                          <FeatherIcon name="check" size={20} color="white" />
                        ) : (
                          <Text className={`${selected ? 'text-white' : 'text-default'} font-bold`}>
                            {day}
                          </Text>
                        )}
                      </Box>
                      {done && !dayDate && <Text className="text-grey text-[11px]">{day}</Text>}
                      {dayDate && (
                        <Text className="text-grey text-[11px] leading-[16px] text-center">
                          {dayDate === today ? t('dailyReading.today') : formattedDate(dayDate)}
                        </Text>
                      )}
                    </Box>
                  </Link>
                )
              })}
            </Box>
          </ScrollView>
          {selectedDate && participation?.startDate && (
            <Box className="self-start">
              <ReadingDatePicker
                value={selectedDate}
                label={t('dailyReading.chooseDate')}
                minimum={participation.startDate}
                maximum={getPlanDayDate(participation.startDate, readings.length)}
                onChange={date =>
                  setChosenDay(getScheduledPlanDay(participation.startDate!, date) ?? 1)
                }
              />
            </Box>
          )}
          {!!missed.length && (
            <Link
              onPress={() => setChosenDay(readings.findIndex(item => item.id === missed[0].id) + 1)}
            >
              <Text className="text-primary text-[13px]">
                {t('readingPlans.missed', { count: missed.length })}
              </Text>
            </Link>
          )}
          {reading && (
            <Box className="bg-reverse rounded-[18px] px-[16px]">
              {reading.slices
                .filter(slice => slice.type !== 'Image')
                .map((slice, index) => {
                  const title =
                    slice.type === 'Chapter'
                      ? chapterToReference(slice.chapters)
                      : slice.type === 'Verse'
                        ? verseToReference(slice.verses, { isPlan: true })
                        : slice.type === 'Video' || slice.type === 'Title'
                          ? slice.title
                          : t('dailyReading.meditationHeading')
                  return (
                    <Box key={`${slice.id}:${index}`}>
                      <Box
                        className={`min-h-[68px] flex-row items-center gap-[14px] py-[14px] ${index ? 'border-t border-border' : ''}`}
                      >
                        <FeatherIcon
                          name={
                            reading.status === 'Completed'
                              ? 'check-circle'
                              : slice.type === 'Video'
                                ? 'play-circle'
                                : 'book-open'
                          }
                          size={22}
                          color={reading.status === 'Completed' ? 'success' : 'grey'}
                        />
                        <Text className="flex-1 text-default text-[17px]">{title}</Text>
                      </Box>
                    </Box>
                  )
                })}
            </Box>
          )}
        </Box>
        <Box className={desktop ? 'self-end min-w-[200px]' : 'w-full'}>
          <Button
            disabled={!reading}
            onPress={() => {
              if (!started) {
                dispatch(startPlan({ planId: plan.id, startDate: today }))
                setChosenDay(1)
                openReading(readings[0])
              } else openReading()
            }}
          >
            {t(
              started
                ? reading?.status === 'Completed'
                  ? 'readingPlans.reread'
                  : 'readingPlans.continue'
                : 'readingPlans.start'
            )}
          </Button>
        </Box>
        {started && reading && (
          <Link
            onPress={() => dispatch(markAsRead({ planId: plan.id, readingSliceId: reading.id }))}
            className="self-center py-[8px]"
          >
            <Text className="text-grey text-[13px]">
              {t(reading.status === 'Completed' ? 'readingPlans.unmark' : 'readingPlans.complete')}
            </Text>
          </Link>
        )}
      </Box>
    </ScrollView>
  )
}
export default ScheduledPlanContent
