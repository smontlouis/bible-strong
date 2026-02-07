import { createContext, useContext } from 'react'

interface PopOverContextType {
  onClose: () => void
  closeAndWait: () => Promise<void>
}

export const PopOverContext = createContext<PopOverContextType | undefined>(undefined)

export const usePopOver = () => {
  const context = useContext(PopOverContext)
  if (!context) {
    throw new Error('usePopOver must be used within a PopOverProvider')
  }
  return context
}
