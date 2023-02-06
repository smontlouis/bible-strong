import React, { createContext, useContext, useReducer } from 'react'

const initialState = {
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

const strongReducer = (state, action) => {
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

const dictionnaireReducer = (state, action) => {
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

const reducer = ({ strong, dictionnaire }, action) => ({
  strong: strongReducer(strong, action),
  dictionnaire: dictionnaireReducer(dictionnaire, action),
})

export const DBStateContext = createContext()
export const DBStateProvider = ({ children }) => (
  <DBStateContext.Provider value={useReducer(reducer, initialState)}>
    {children}
  </DBStateContext.Provider>
)
export const useDBStateValue = () => useContext(DBStateContext)
