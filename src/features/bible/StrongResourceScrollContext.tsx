import React from 'react'

export type StrongResourceScrollValue = {
  currentTarget: { code: string | number; occurrenceIndex: number } | null
  registerStrongWordLayout: (occurrenceIndex: number, verseContentOffsetY: number) => void
  scrollToStrongCard: (reference: string | number, occurrenceIndex: number) => void
}

const StrongResourceScrollContext = React.createContext<StrongResourceScrollValue | null>(null)

export const StrongResourceScrollProvider = StrongResourceScrollContext.Provider
export const StrongResourceScrollConsumer = StrongResourceScrollContext.Consumer
