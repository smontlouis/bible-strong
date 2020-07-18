import React from 'react'
import { SelectedCode, Settings } from './types'

interface VerseContextProps {
  selectedCode: SelectedCode
  settings: Settings
  onTouchMove: (event: React.TouchEvent<HTMLSpanElement>) => void
}

const VerseContext = React.createContext<VerseContextProps>(undefined!)

export const VerseProvider = VerseContext.Provider
export const VerseConsumer = VerseContext.Consumer

export default VerseContext
