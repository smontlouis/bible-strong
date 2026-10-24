import { Image } from 'expo-image'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Platform, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { ComputedPlan, ComputedReadingSlice, EntitySlice } from '~common/types'
import Link from '~common/Link'
import Sheet from '~common/ModalSheet'
import { SheetView, type SheetRef } from '~common/sheet'
import Border from '~common/ui/Border'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Card from '~common/ui/Card'
import SheetWell from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import ReminderSettings from '~features/daily-reading/ReminderSettings'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import verseToReference from '~helpers/verseToReference'
import {
  startPlan,
  markAsRead,
  markEntitySliceAsRead,
  markEntitySliceAsUnread,
  setPlanReminder,
} from '~redux/modules/plan'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { RootState } from '~redux/modules/reducer'
import { useFireStorage } from '../plan.hooks'
import { getPlanDayDate, getScheduledPlanDay } from '../readingCalendar'
import {
  hasPlanParticipation,
  getEntitySliceKey,
  getReadEntitySliceKeys,
  isReadableEntitySlice,
} from '../planProgress'
import { getDoneDays, getPlanJourney } from '../planSchedule'
import { getDayMinutes, useElementSizes } from '../planReadingTime'
import { getPlanEntityRoute } from '../planEntityRoute'
import {
  getEntitySliceTitle,
  getReadingSliceFirstVerse,
  getReadingSliceLabel,
} from '../entitySliceTitle'
import PlanStreak from '../PlanStreak'
import PlanCalendar from './PlanCalendar'
import PlanDayStrip, { formatPlanDate } from './PlanDayStrip'
import PlanElementRow from './PlanElementRow'
import PlanProgressCard from './PlanProgressCard'
import PlanReflection from './PlanReflection'
import PlanUpNext from './PlanUpNext'

interface Props {
  plan: ComputedPlan
  /** The day to show first, when the reader arrives from a link to that day. */
  initialReadingSliceId?: string
}

/** From this width the day and what goes with it sit side by side. */
const WIDE = 800
const SIDE_WIDTH = 300
const MAX_WIDTH = 1000
const MAX_WIDTH_WIDE = 1080
/** Where an element's name starts in its row, after the checkbox. */
const ELEMENT_INSET = 50

const shorten = (text: string, length = 32) =>
  text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text

const ScheduledPlanContent = ({ plan, initialReadingSliceId }: Props) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const dispatch = useDispatch()
  const participation = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const started = hasPlanParticipation(participation)
  const startDate = participation?.startDate
  const [width, setWidth] = useState(0)
  const wide = width >= WIDE
  const contentWidth = Math.min(width, wide ? MAX_WIDTH_WIDE : MAX_WIDTH)
  const today = useLocalReadingDate()
  const params = useLocalSearchParams<{ date?: string; continue?: string }>()
  const bottomInset = usePageBottomInset()
  const readings = plan.sections.flatMap(section => section.data)
  const journey = getPlanJourney(getDoneDays(readings), startDate, today)
  const [chosenDay, setChosenDay] = useState<number | null>(
    () => readings.findIndex(item => item.id === initialReadingSliceId) + 1 || null
  )
  const selectedDay = Math.max(
    1,
    Math.min(
      readings.length,
      chosenDay ??
        (startDate && params.date ? getScheduledPlanDay(startDate, params.date) : undefined) ??
        (started ? journey.currentDay : 1)
    )
  )
  const reading = readings[selectedDay - 1]
  const readEntityKeys = reading && started ? getReadEntitySliceKeys(reading, participation) : []
  const selectedDate = startDate ? getPlanDayDate(startDate, selectedDay) : undefined
  const sizes = useElementSizes(reading)
  const minutes = getDayMinutes(sizes)
  const cover = useFireStorage(plan.image)
  const calendarSheet = useRef<SheetRef>(null)
  // Opening is reading. The element is ticked once its page covers the plan, so that a day
  // completed this way is celebrated on the way back, not while leaving. A sheet leaves the
  // plan in view while it rises, so the tick waits for it to settle.
  const navigation = useNavigation()
  const openedEntity = useRef<Parameters<typeof markEntitySliceAsRead>[0] | null>(null)
  useEffect(() => {
    const pending = new Map<
      ReturnType<typeof setTimeout>,
      Parameters<typeof markEntitySliceAsRead>[0]
    >()
    const unsubscribe = navigation.addListener('blur', () => {
      const location = openedEntity.current
      if (!location) return
      openedEntity.current = null
      const timer = setTimeout(() => {
        pending.delete(timer)
        dispatch(markEntitySliceAsRead(location))
      }, 500)
      pending.set(timer, location)
    })
    return () => {
      unsubscribe()
      // Leaving the plan for good must not lose an element that was opened.
      pending.forEach((location, timer) => {
        clearTimeout(timer)
        dispatch(markEntitySliceAsRead(location))
      })
      pending.clear()
    }
  }, [navigation, dispatch])
  const openEntity = (day: ComputedReadingSlice, slice: EntitySlice, index: number) => {
    const location = {
      planId: plan.id,
      readingSliceId: day.id,
      entitySliceId: getEntitySliceKey(day.id, slice, index),
    }
    const route = getPlanEntityRoute({ ...location, slice })
    if (!route) return
    openedEntity.current = location
    pushRouteOnce(route)
  }
  /** The next element to read in a day, or its first one when the day is done. */
  const getNextElement = (day = reading) => {
    if (!day) return undefined
    const readKeys = getReadEntitySliceKeys(day, participation)
    const readable = day.slices
      .map((slice, index) => ({ slice, index }))
      .filter(({ slice }) => isReadableEntitySlice(slice))
    return (
      readable.find(
        ({ slice, index }) => !readKeys.includes(getEntitySliceKey(day.id, slice, index))
      ) ?? readable[0]
    )
  }
  const openDay = (day = reading) => {
    const next = getNextElement(day)
    if (day && next) openEntity(day, next.slice, next.index)
  }

  // « Continuer » on the home or in the list lands here and opens what follows at once, over
  // the plan: going back shows the plan, where a finished day is celebrated.
  const continued = useRef(false)
  useEffect(() => {
    if (params.continue !== '1' || continued.current || !started) return
    continued.current = true
    setChosenDay(journey.continueDay)
    openDay(readings[journey.continueDay - 1])
    router.setParams({ continue: undefined })
    // Runs once, when the plan arrives with the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.continue, started])

  if (!readings.length)
    return (
      <Box className="p-[24px]">
        <Text className="text-grey">{t('dailyReading.noEntry')}</Text>
      </Box>
    )

  const label = reading ? getReadingSliceLabel(reading, t) : ''
  const subtitle = [
    selectedDate
      ? formatPlanDate(selectedDate, i18n.language, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : label
        ? t('readingPlans.dayOfTotal', { day: selectedDay, total: readings.length })
        : undefined,
    minutes ? t('readingPlans.aboutMinutes', { count: minutes }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  const firstVerse = reading ? getReadingSliceFirstVerse(reading) : undefined
  const nextElement = getNextElement()
  const isCurrentDay = selectedDay === journey.currentDay
  const primary = !started
    ? {
        label: t('readingPlans.start'),
        onPress: () => {
          dispatch(startPlan({ planId: plan.id, startDate: today }))
          setChosenDay(1)
          openDay(readings[0])
        },
      }
    : reading?.status !== 'Completed'
      ? {
          label: nextElement
            ? t('readingPlans.continueWith', {
                title: shorten(getEntitySliceTitle(nextElement.slice, t)),
              })
            : t('readingPlans.continue'),
          onPress: () => openDay(),
        }
      : isCurrentDay && journey.missed.length
        ? {
            label: t('readingPlans.catchUpDay', { day: journey.missed[0] }),
            onPress: () => {
              setChosenDay(journey.missed[0])
              openDay(readings[journey.missed[0] - 1])
            },
          }
        : { label: t('readingPlans.reread'), onPress: () => openDay() }

  const header = (
    <Box className={wide ? 'flex-row items-center gap-[24px]' : 'items-center gap-[16px]'}>
      {cover && (
        <Box
          className="bg-surface rounded-[12px] overflow-hidden"
          style={{ width: wide ? 180 : 144, height: wide ? 104 : 88 }}
        >
          <Image
            source={{ uri: cover }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
      )}
      <Box className={wide ? 'flex-1 gap-[12px]' : 'w-full items-center gap-[8px]'}>
        <Text className={`text-default font-bold text-[26px] ${wide ? '' : 'text-center'}`}>
          {plan.title}
        </Text>
        <Text className="text-grey text-[14px]">{plan.author?.displayName}</Text>
        {started && !wide && (
          <Box className="flex-row items-center gap-[10px] mt-[8px]">
            <Box
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: readings.length, now: journey.completed }}
              className="w-[80px] h-[6px] rounded-full bg-border overflow-hidden"
            >
              <Box
                className="h-full bg-primary rounded-full"
                style={{ width: `${(journey.completed / readings.length) * 100}%` }}
              />
            </Box>
            <Text className="text-grey text-[13px]" style={{ fontVariant: ['tabular-nums'] }}>
              {journey.finished
                ? t('readingPlans.finished')
                : t('readingPlans.daysProgress', {
                    count: journey.completed,
                    total: readings.length,
                  })}
            </Text>
            <PlanStreak count={journey.streak} />
          </Box>
        )}
      </Box>
    </Box>
  )

  const dayCard = (
    <Card className="rounded-[24px] p-[16px] gap-[16px]">
      <Box className="flex-row items-start justify-between gap-[12px]">
        <Box className="flex-1 gap-[4px]">
          <Text className="text-default font-bold text-[18px]" numberOfLines={2}>
            {label
              ? t('readingPlans.dayLabel', { day: selectedDay, label })
              : t('readingPlans.dayOfTotal', { day: selectedDay, total: readings.length })}
          </Text>
          {!!subtitle && (
            <Text className="text-grey text-[13px]">
              {subtitle.charAt(0).toUpperCase() + subtitle.slice(1)}
            </Text>
          )}
        </Box>
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
      <PlanDayStrip
        done={journey.done}
        today={journey.today}
        selectedDay={selectedDay}
        startDate={startDate}
        width={Math.max(0, (wide ? contentWidth - SIDE_WIDTH - 24 - 64 : contentWidth - 40) - 32)}
        onSelect={setChosenDay}
      />
      {((startDate && !wide) || !!journey.missed.length) && (
        <Box className="flex-row flex-wrap items-center justify-between gap-[12px]">
          {startDate && !wide && (
            <Link
              accessibilityRole="button"
              accessibilityLabel={t('readingPlans.calendar')}
              onPress={() => calendarSheet.current?.present()}
              className="flex-row items-center gap-[6px] rounded-full bg-canvas px-[12px] h-[32px]"
            >
              <FeatherIcon name="calendar" size={14} color="primary" />
              <Text className="text-link text-[13px] font-bold">{t('readingPlans.calendar')}</Text>
            </Link>
          )}
          {!!journey.missed.length && (
            <Link onPress={() => setChosenDay(journey.missed[0])}>
              <Text className="text-link text-[13px]">
                {t('readingPlans.missed', { count: journey.missed.length })}
              </Text>
            </Link>
          )}
        </Box>
      )}
      {reading && <Button onPress={primary.onPress}>{primary.label}</Button>}
      {reading && (
        <Box>
          {reading.slices.map((slice, index) => {
            const title = getEntitySliceTitle(slice, t)
            if (slice.type === 'Title')
              return (
                <Box key={`${slice.id}:${index}`}>
                  {!!index && <Border />}
                  <Text className="text-grey text-[13px] pt-[18px] pb-[8px]">{title}</Text>
                </Box>
              )
            if (!isReadableEntitySlice(slice)) return null
            const entitySliceId = getEntitySliceKey(reading.id, slice, index)
            const location = { planId: plan.id, readingSliceId: reading.id, entitySliceId }
            const read = readEntityKeys.includes(entitySliceId)
            return (
              <Box key={entitySliceId}>
                {/* The hairline starts where the element's name starts. */}
                <Border style={{ marginLeft: started ? ELEMENT_INSET : 0 }} />
                <PlanElementRow
                  slice={slice}
                  title={title}
                  size={sizes[entitySliceId]}
                  started={started}
                  read={read}
                  onToggle={() => {
                    // Stay on this day: ticking its last element must not move to the next one.
                    setChosenDay(selectedDay)
                    dispatch(
                      read ? markEntitySliceAsUnread(location) : markEntitySliceAsRead(location)
                    )
                  }}
                  onOpen={() => openEntity(reading, slice, index)}
                />
              </Box>
            )
          })}
        </Box>
      )}
      {started && reading && (
        <Link
          onPress={() => dispatch(markAsRead({ planId: plan.id, readingSliceId: reading.id }))}
          className="self-center py-[4px]"
        >
          <Text className="text-grey text-[13px]">
            {t(reading.status === 'Completed' ? 'readingPlans.unmark' : 'readingPlans.complete')}
          </Text>
        </Link>
      )}
    </Card>
  )

  const reflection = started && firstVerse && (
    <PlanReflection verseKey={firstVerse} reference={verseToReference(firstVerse)} />
  )
  const upNext = (
    <PlanUpNext
      readings={readings}
      day={selectedDay}
      startDate={startDate}
      onSelect={setChosenDay}
    />
  )
  const reminder = started && startDate && Platform.OS !== 'web' && (
    <ReminderSettings
      surface="card"
      showIcon
      scope={`plan:${plan.id}`}
      time={participation?.reminderTime}
      onChange={time => dispatch(setPlanReminder({ planId: plan.id, time }))}
    />
  )

  return (
    <>
      <ScrollView
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={[
          pageContentStyle,
          {
            maxWidth: wide ? MAX_WIDTH_WIDE : MAX_WIDTH,
            padding: wide ? 32 : 20,
            paddingBottom: 48 + bottomInset,
          },
        ]}
      >
        <Box className="gap-[28px]">
          {header}
          {!started && !!plan.description && (
            <Text className="text-default text-[15px] leading-[24px]">{plan.description}</Text>
          )}
          {wide ? (
            <Box className="flex-row items-start gap-[24px]">
              <Box className="flex-1 gap-[28px]">
                {dayCard}
                {reflection}
              </Box>
              <Box className="gap-[20px]" style={{ width: SIDE_WIDTH }}>
                {started && (
                  <PlanProgressCard
                    completed={journey.completed}
                    total={readings.length}
                    streak={journey.streak}
                  />
                )}
                {startDate && (
                  <Card className="p-[16px]">
                    <PlanCalendar
                      key={selectedDay}
                      startDate={startDate}
                      done={journey.done}
                      today={journey.today}
                      selectedDay={selectedDay}
                      onSelect={setChosenDay}
                    />
                  </Card>
                )}
                {upNext}
                {reminder}
              </Box>
            </Box>
          ) : (
            <>
              {dayCard}
              {reflection}
              {upNext}
              {reminder}
            </>
          )}
        </Box>
      </ScrollView>
      {startDate && !wide && (
        <Sheet ref={calendarSheet} modalTitle={t('readingPlans.calendar')}>
          <SheetView className="p-[20px]">
            <SheetWell className="p-[16px]">
              <PlanCalendar
                startDate={startDate}
                done={journey.done}
                today={journey.today}
                selectedDay={selectedDay}
                onSelect={day => {
                  setChosenDay(day)
                  calendarSheet.current?.dismiss()
                }}
              />
            </SheetWell>
          </SheetView>
        </Sheet>
      )}
    </>
  )
}
export default ScheduledPlanContent
