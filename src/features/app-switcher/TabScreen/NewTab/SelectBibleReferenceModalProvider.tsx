import React, { createContext, useContext } from 'react'
import { useSetAtom } from 'jotai/react'
import { BibleTab } from '../../../../state/tabs'
import SelectBibleReferenceModal from './SelectBibleReferenceModal'
import { selectBibleReferenceDataAtom } from './atoms'

interface SelectBibleReferenceContextType {
  openBibleReferenceModal: (params: {
    onSelect: (data: BibleTab['data']['temp']) => void
  }) => void
}

const SelectBibleReferenceContext =
  createContext<SelectBibleReferenceContextType | null>(null)

export const useSelectBibleReference = () => {
  const context = useContext(SelectBibleReferenceContext)
  if (!context) {
    throw new Error(
      'useSelectBibleReference must be used within a SelectBibleReferenceModalProvider'
    )
  }
  return context
}

export const SelectBibleReferenceModalProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const setSelectBibleReferenceData = useSetAtom(selectBibleReferenceDataAtom)

  const openBibleReferenceModal = ({
    onSelect,
  }: {
    onSelect: (data: BibleTab['data']['temp']) => void
  }) => {
    setSelectBibleReferenceData({ onSelect })
    setIsOpen(true)
  }

  return (
    <SelectBibleReferenceContext.Provider value={{ openBibleReferenceModal }}>
      {children}
      <SelectBibleReferenceModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </SelectBibleReferenceContext.Provider>
  )
}
