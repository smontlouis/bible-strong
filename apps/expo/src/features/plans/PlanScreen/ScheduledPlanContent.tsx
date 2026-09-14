import ReadingDatePicker from '~features/daily-reading/ReadingDatePicker'
import { Image } from 'expo-image'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { ComputedPlan, ComputedReadingSlice, Plan } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import ReminderSettings from '~features/daily-reading/ReminderSettings'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { startPlan, setPlanReminder, markAsRead } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import { useFireStorage } from '../plan.hooks'
import { getPlanDayDate, getScheduledPlanDay, isCivilDate } from '../readingCalendar'
import EntitySlice from './EntitySlice'

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
  const today = useLocalReadingDate()
  const params = useLocalSearchParams<{ date?: string }>()
  const [startDate, setStartDate] = useState(today)
  const [chosenDay, setChosenDay] = useState<number | null>(null)
  const readings = plan.sections.flatMap(section => section.data)
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
        scheduledDay ??
        1
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
  const formattedDate = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
    })
  const openReading = () => {
    if (!reading) return
    const payload = { ...reading, planId: plan.id, planTitle: plan.title, planLanguage: plan.lang }
    if (onReadingSlicePress) onReadingSlicePress(payload)
    else
      router.push({
        pathname: '/plan-slice',
        params: { planId: plan.id, readingSliceId: reading.id },
      })
  }

  return (
    <ScrollView contentContainerStyle={[pageContentStyle, { padding: 24, paddingBottom: 48 }]}>
      <Box className="gap-[24px]">
        {cover && (
          <Box
            className="rounded-[24px] overflow-hidden bg-light-grey"
            style={{ aspectRatio: 2.2, maxHeight: 240 }}
          >
            <Image
              source={{ uri: cover }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          </Box>
        )}
        <Box className="gap-[10px]">
          <Text className="text-primary font-bold text-[12px] uppercase">
            {t('readingPlans.duration', { count: readings.length })}
          </Text>
          <Text className="text-default font-bold text-[28px]">{plan.title}</Text>
          <Text className="text-grey text-[14px]">{plan.author?.displayName}</Text>
        </Box>
        {!participation?.startDate ? (
          <>
            <Text className="text-default text-[16px] leading-[26px]">{plan.description}</Text>
            <Box className="bg-light-grey rounded-[24px] p-[20px] gap-[16px]">
              <Text className="text-default font-bold text-[18px]">
                {t('readingPlans.startTitle')}
              </Text>
              <Text className="text-grey text-[14px] leading-[22px]">
                {t('readingPlans.startDescription')}
              </Text>
              <ReadingDatePicker
                value={startDate}
                label={t('readingPlans.startDate')}
                onChange={setStartDate}
              />
              <Button
                disabled={!isCivilDate(startDate)}
                onPress={() => dispatch(startPlan({ planId: plan.id, startDate }))}
              >
                {t('readingPlans.start')}
              </Button>
              {!!plan.progress && (
                <Text className="text-grey text-[13px]">{t('readingPlans.keepProgress')}</Text>
              )}
            </Box>
          </>
        ) : (
          <Box className="bg-light-grey rounded-[24px] p-[20px] gap-[12px]">
            <Box className="flex-row justify-between gap-[12px]">
              <Text className="text-default font-bold">
                {t('readingPlans.progress', {
                  count: readings.filter(item => item.status === 'Completed').length,
                  total: readings.length,
                })}
              </Text>
              <Text className="text-primary font-bold">{Math.round(plan.progress * 100)} %</Text>
            </Box>
            <Box className="bg-reverse rounded-[4px] h-[6px] overflow-hidden">
              <Box
                className="bg-primary h-[6px]"
                style={{ width: `${Math.round(plan.progress * 100)}%` }}
              />
            </Box>
            <Text className="text-grey text-[13px]">
              {t('readingPlans.since', { date: formattedDate(participation.startDate) })}
            </Text>
            {scheduledDay !== undefined && scheduledDay < 1 && (
              <Text className="text-grey">{t('readingPlans.upcoming')}</Text>
            )}
            {!!missed.length && (
              <Link
                className="py-[8px]"
                onPress={() =>
                  setChosenDay(readings.findIndex(item => item.id === missed[0].id) + 1)
                }
              >
                <Text className="text-primary">
                  {t('readingPlans.missed', { count: missed.length })}
                </Text>
              </Link>
            )}
          </Box>
        )}
        <Box className="flex-row justify-between items-center gap-[12px]">
          <Link
            size={44}
            disabled={selectedDay <= 1}
            onPress={() => setChosenDay(selectedDay - 1)}
            accessibilityLabel={t('dailyReading.previous')}
          >
            <FeatherIcon
              name="chevron-left"
              size={20}
              color={selectedDay <= 1 ? 'grey' : 'primary'}
            />
          </Link>
          <Box className="items-center gap-[4px]">
            <Text className="text-default font-bold text-[18px]">
              {t('readingPlans.day', { day: selectedDay })}
            </Text>
            {selectedDate && participation?.startDate && (
              <ReadingDatePicker
                value={selectedDate}
                label={t('dailyReading.chooseDate')}
                minimum={participation.startDate}
                maximum={getPlanDayDate(participation.startDate, readings.length)}
                onChange={date =>
                  setChosenDay(getScheduledPlanDay(participation.startDate!, date) ?? 1)
                }
              />
            )}
          </Box>
          <Link
            size={44}
            disabled={selectedDay >= readings.length}
            onPress={() => setChosenDay(selectedDay + 1)}
            accessibilityLabel={t('dailyReading.next')}
          >
            <FeatherIcon
              name="chevron-right"
              size={20}
              color={selectedDay >= readings.length ? 'grey' : 'primary'}
            />
          </Link>
        </Box>
        {reading && (
          <Box className="gap-[16px]">
            {reading.title && (
              <Text className="text-default font-bold text-[18px]">{reading.title}</Text>
            )}
            {reading.slices
              .filter(slice => slice.type === 'Chapter' || slice.type === 'Verse')
              .map((slice, index) => (
                <EntitySlice
                  key={`${slice.id}:${index}`}
                  {...slice}
                  status={reading.status}
                  isSectionCompleted={reading.status === 'Completed'}
                />
              ))}
            <Button onPress={openReading}>
              {t(participation?.startDate ? 'readingPlans.read' : 'readingPlans.preview')}
            </Button>
            {participation?.startDate && (
              <Button
                reverse
                onPress={() =>
                  dispatch(markAsRead({ planId: plan.id, readingSliceId: reading.id }))
                }
              >
                {t(
                  reading.status === 'Completed' ? 'readingPlans.unmark' : 'readingPlans.complete'
                )}
              </Button>
            )}
          </Box>
        )}
        {participation?.startDate && (
          <ReminderSettings
            scope={`plan:${plan.id}`}
            time={participation.reminderTime}
            onChange={time => dispatch(setPlanReminder({ planId: plan.id, time }))}
          />
        )}
      </Box>
    </ScrollView>
  )
}
export default ScheduledPlanContent
