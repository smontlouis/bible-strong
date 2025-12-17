import { createContext, useContext } from 'react'
import { Dispatch } from './BibleDOMWrapper'

type DispatchContextValues = Dispatch

const DispatchContext = createContext<DispatchContextValues | undefined>(undefined)

interface DispatchProviderProps {
  dispatch: Dispatch
  children: React.ReactNode
}

export const DispatchProvider = ({ dispatch, children }: DispatchProviderProps) => {
  return <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
}

export const useDispatch = () => {
  const context = useContext(DispatchContext)

  if (!context) {
    throw new Error('useAppSwitcherContext must be used within an AppSwitcherProvider')
  }

  return context
}
