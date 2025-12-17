import { useTranslation } from 'react-i18next'
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { firebaseDb } from '~helpers/firebase'
import { useQuery } from '~helpers/react-query-lite'
import { getLangIsFr } from '~i18n'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import React from 'react'
import { useFireStorage } from '~features/plans/plan.hooks'
import { StyleSheet, Linking, Pressable, TouchableOpacity } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

type Event = {
  title: string
  description: string
  startDate?: {
    _seconds: number
    _nanoseconds: number
  }
  endDate?: {
    _seconds: number
    _nanoseconds: number
  }
  status: 'published' | 'draft'
  lang: 'fr' | 'en'
  img: string
  url: string
}

const getEvents = async () => {
  const events = await firebaseDb
    .collection('events')
    .where('status', '==', 'published')
    .where('lang', '==', getLangIsFr() ? 'fr' : 'en')
    .get()
  return events.docs.map(x => x.data() as Event)
}

const EventPeriod = ({ event }: { event: Event }) => {
  const locale = getLangIsFr() ? fr : enUS

  if (!event.startDate && !event.endDate) return null

  const startDate = event.startDate ? new Date(event.startDate._seconds * 1000) : null
  const endDate = event.endDate ? new Date(event.endDate._seconds * 1000) : null

  if (startDate && endDate) {
    return (
      <Text bold color="white" fontSize={12}>
        {format(startDate, 'dd MMM yy', { locale })} - {format(endDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  if (startDate) {
    return (
      <Text bold color="white" fontSize={12}>
        {format(startDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  if (endDate) {
    return (
      <Text bold color="white" fontSize={12}>
        {format(endDate, 'dd MMM yy', { locale })}
      </Text>
    )
  }

  return null
}

export const Events = () => {
  const { t } = useTranslation()

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => getEvents(),
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
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <VStack
        paddingHorizontal={20}
        borderRadius={30}
        borderWidth={3}
        borderColor="lightPrimary"
        marginHorizontal={20}
        bg="black"
        py={20}
        gap={8}
      >
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
        <HStack gap={8} alignItems="center">
          <HStack bg="lightPrimary" borderRadius={10} center height={22} gap={4} px={8}>
            <Text bold fontSize={12}>
              {t('event')}
            </Text>
          </HStack>
        </HStack>
        <Text title fontSize={22} color="white">
          {event?.title}
        </Text>
        <Text bold color="white">
          {event?.description}
        </Text>
        <HStack gap={4} alignItems="center">
          <FeatherIcon name="calendar" size={16} color="white" />
          {event && <EventPeriod event={event} />}
        </HStack>
      </VStack>
    </TouchableOpacity>
  )
}
