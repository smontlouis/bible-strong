import React, { createContext, useContext } from 'react'
import type { JSONValue } from 'expo/build/dom/dom.types'

type DispatchContextType = (action: { type: string; payload?: JSONValue }) => void

const DispatchContext = createContext<DispatchContextType | null>(null)

export const DispatchProvider = ({
  children,
  dispatch,
}: {
  children: React.ReactNode
  dispatch: DispatchContextType
}) => {
  return <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
}

export const useDispatch = () => {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) {
    throw new Error('useDispatch must be used within a DispatchProvider')
  }
  return dispatch
}
