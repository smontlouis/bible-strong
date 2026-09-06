import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useTranslation } from 'react-i18next'
import { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { collection, firebaseDb, getDocs, query, where } from '~helpers/firebase'
import { useQuery } from '@tanstack/react-query'
import { remoteQueryOptions } from '~helpers/queryOptions'
import { getLanguage } from '~i18n'
import { getDateLocale } from '~helpers/languageUtils'
import { format } from 'date-fns'
import React from 'react'
import { useFireStorage } from '~features/plans/plan.hooks'
import { StyleSheet, Linking, TouchableOpacity } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import useLanguage from '~helpers/useLanguage'
type Event = {
  title: string
  description: string
  startDate?: FirestoreTimestamp
  endDate?: FirestoreTimestamp
  status: 'published' | 'draft'
  lang: 'fr' | 'en'
  img: string
  url: string
}

type FirestoreTimestamp = {
  _seconds?: number
  seconds?: number
  toDate?: () => Date
}

export const normalizeEventDate = (value: FirestoreTimestamp | undefined): Date | null => {
  if (!value) return null
  const date = typeof value.toDate === 'function' ? value.toDate() : undefined
  if (date && Number.isFinite(date.getTime())) return date
  const seconds = value.seconds ?? value._seconds
  if (typeof seconds !== 'number') return null
  const normalized = new Date(seconds * 1000)
  return Number.isFinite(normalized.getTime()) ? normalized : null
}

const getEvents = async (language: string) => {
  const events = await getDocs(
    query(
      collection(firebaseDb, 'events'),
      where('status', '==', 'published'),
      where('lang', '==', language)
    )
  )
  return events.docs.map((x: { data: () => unknown }) => x.data() as Event)
}

const EventPeriod = ({ event }: { event: Event }) => {
  const locale = getDateLocale(getLanguage())

  if (!event.startDate && !event.endDate) return null

  const startDate = normalizeEventDate(event.startDate)
  const endDate = normalizeEventDate(event.endDate)

  if (startDate && endDate) {
    return (
      <Text className="font-bold text-[white] text-[12px]">
        {format(startDate, 'dd MMM yy', { locale })} - {format(endDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  if (startDate) {
    return (
      <Text className="font-bold text-[white] text-[12px]">
        {format(startDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  if (endDate) {
    return (
      <Text className="font-bold text-[white] text-[12px]">
        {format(endDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  return null
}

export const Events = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const language = useLanguage()

  const { data: events } = useQuery({
    queryKey: ['events', language],
    queryFn: () => getEvents(language),
    ...remoteQueryOptions,
  })

  const event = events?.[0]
  const imageUri = useFireStorage(event?.img)

  const handlePress = async () => {
    if (event?.url) {
      await Linking.openURL(event.url)
    }
  }

  if (!event) return null

  return (
    <TouchableOpacity accessibilityRole="button" onPress={handlePress} activeOpacity={0.8}>
      <VStack className="border-continuous overflow-hidden px-[20px] rounded-[30px] border-[3px] border-light-primary mx-[20px] bg-[black] py-[20px] gap-[8px]">
        {imageUri && (
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 1)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            }
          >
            <Image
              style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
              source={{ uri: imageUri }}
              contentFit="cover"
            />
          </MaskedView>
        )}
        <HStack className="overflow-hidden border-continuous gap-[8px] items-center">
          <HStack className="overflow-hidden border-continuous bg-light-primary rounded-[10px] items-center justify-center h-[22px] gap-[4px] px-[8px]">
            <Text className="font-bold text-[12px]">{t('event')}</Text>
          </HStack>
        </HStack>
        <Text
          className="text-[22px] text-[white]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {event?.title}
        </Text>
        <Text className="font-bold text-[white]">{event?.description}</Text>
        <HStack className="overflow-hidden border-continuous gap-[4px] items-center">
          <FeatherIcon name="calendar" size={16} color="white" />
          {event && <EventPeriod event={event} />}
        </HStack>
      </VStack>
    </TouchableOpacity>
  )
}
