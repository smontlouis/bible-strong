import React from 'react'

export interface GlobalContextProps {
  fullscreen: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
  iap: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
  connection: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
  premiumModal: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
}

export const GlobalContext = React.createContext<GlobalContextProps>(undefined!)

export const useGlobalContext = () => {
  const store = React.useContext(GlobalContext)
  return store
}
