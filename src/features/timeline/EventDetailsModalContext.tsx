import BottomSheet, { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet'
import React, { createContext, useContext, useRef, useState } from 'react'
import { TimelineEvent } from './types'

interface EventDetailsModalContextValue {
  openEvent: (event: Partial<TimelineEvent>) => void
  goBack: () => void
  canGoBack: boolean
}

const EventDetailsModalContext = createContext<EventDetailsModalContextValue | null>(null)

interface ProviderProps {
  children: React.ReactNode
  modalRef: React.RefObject<BottomSheet | null>
  scrollViewRef: React.RefObject<BottomSheetScrollViewMethods | null>
  currentEvent: Partial<TimelineEvent> | null
  setEvent: (event: Partial<TimelineEvent> | null) => void
}

export const EventDetailsModalProvider = ({
  children,
  modalRef,
  scrollViewRef,
  currentEvent,
  setEvent,
}: ProviderProps) => {
  const [eventHistory, setEventHistory] = useState<Partial<TimelineEvent>[]>([])

  const openEvent = (e: Partial<TimelineEvent>) => {
    if (currentEvent) {
      setEventHistory(prev => [...prev, currentEvent])
    }
    setEvent(e)
    console.log('[Timeline] Opening event modal (nested)')
    modalRef.current?.expand()
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)
  }

  const goBack = () => {
    if (eventHistory.length === 0) return
    const prev = eventHistory[eventHistory.length - 1]
    setEventHistory(h => h.slice(0, -1))
    setEvent(prev)
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)
  }

  const canGoBack = eventHistory.length > 0

  return (
    <EventDetailsModalContext.Provider value={{ openEvent, goBack, canGoBack }}>
      {children}
    </EventDetailsModalContext.Provider>
  )
}

export const useEventDetailsModal = () => {
  const context = useContext(EventDetailsModalContext)
  if (!context) {
    throw new Error('useEventDetailsModal must be used within EventDetailsModalProvider')
  }
  return context
}
