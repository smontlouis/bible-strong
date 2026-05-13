import React, { createContext, useContext, useReducer, Dispatch } from 'react'

interface DBSubState {
  isLoading: boolean
  proposeDownload: boolean
  startDownload: boolean
  progress: number
}

interface DBState {
  strong: DBSubState
  dictionnaire: DBSubState
}

type StrongAction =
  | { type: 'strong.setLoading'; payload: boolean }
  | { type: 'strong.setProposeDownload'; payload: boolean }
  | { type: 'strong.setStartDownload'; payload: boolean }
  | { type: 'strong.setProgress'; payload: number }
  | { type: 'strong.reset' }

type DictionnaireAction =
  | { type: 'dictionnaire.setLoading'; payload: boolean }
  | { type: 'dictionnaire.setProposeDownload'; payload: boolean }
  | { type: 'dictionnaire.setStartDownload'; payload: boolean }
  | { type: 'dictionnaire.setProgress'; payload: number }
  | { type: 'dictionnaire.reset' }

export type DBAction = StrongAction | DictionnaireAction

const initialState: DBState = {
  strong: {
    isLoading: true,
    proposeDownload: false,
    startDownload: false,
    progress: 0,
  },
  dictionnaire: {
    isLoading: true,
    proposeDownload: false,
    startDownload: false,
    progress: 0,
  },
}

const strongReducer = (state: DBSubState, action: DBAction): DBSubState => {
  switch (action.type) {
    case 'strong.setLoading':
      return {
        ...state,
        isLoading: action.payload,
      }
    case 'strong.setProposeDownload':
      return {
        ...state,
        proposeDownload: action.payload,
      }
    case 'strong.setStartDownload':
      return {
        ...state,
        startDownload: action.payload,
      }
    case 'strong.setProgress':
      return {
        ...state,
        progress: action.payload,
      }
    case 'strong.reset':
      return { ...initialState.strong, proposeDownload: true }
    default:
      return state
  }
}

const dictionnaireReducer = (state: DBSubState, action: DBAction): DBSubState => {
  switch (action.type) {
    case 'dictionnaire.setLoading':
      return {
        ...state,
        isLoading: action.payload,
      }
    case 'dictionnaire.setProposeDownload':
      return {
        ...state,
        proposeDownload: action.payload,
      }
    case 'dictionnaire.setStartDownload':
      return {
        ...state,
        startDownload: action.payload,
      }
    case 'dictionnaire.setProgress':
      return {
        ...state,
        progress: action.payload,
      }
    case 'dictionnaire.reset':
      return { ...initialState.dictionnaire, proposeDownload: true }
    default:
      return state
  }
}

const reducer = ({ strong, dictionnaire }: DBState, action: DBAction): DBState => ({
  strong: strongReducer(strong, action),
  dictionnaire: dictionnaireReducer(dictionnaire, action),
})

type DBStateContextValue = [DBState, Dispatch<DBAction>]

export const DBStateContext = createContext<DBStateContextValue>(
  undefined as unknown as DBStateContextValue
)
export const DBStateProvider = ({ children }: { children: React.ReactNode }) => (
  <DBStateContext.Provider value={useReducer(reducer, initialState)}>
    {children}
  </DBStateContext.Provider>
)
export const useDBStateValue = (): DBStateContextValue => useContext(DBStateContext)
