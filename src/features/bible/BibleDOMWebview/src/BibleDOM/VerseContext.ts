import { createContext } from 'react'
import { SelectedCode } from '../../../../../common/types'
import { RootState } from '../../../../../redux/modules/reducer'

interface VerseContextProps {
  selectedCode?: SelectedCode | null
  settings: RootState['user']['bible']['settings']
  onTouchMove: (event: React.TouchEvent<HTMLSpanElement>) => void
}

const VerseContext = createContext<VerseContextProps>(undefined!)

export const VerseProvider = VerseContext.Provider
export const VerseConsumer = VerseContext.Consumer

export default VerseContext
