import { createContext, useContext, useState } from 'react'
import { useSetAtom } from 'jotai/react'

import UnifiedTagsModal, { UnifiedTagsModalInstance } from '~common/UnifiedTagsModal'
import { unifiedTagsModalAtom, type UnifiedTagsModalProps } from '~state/app'

type UnifiedTagsModalPayload = Exclude<UnifiedTagsModalProps, false>
type OpenUnifiedTagsModal = (payload: UnifiedTagsModalPayload) => void

const UnifiedTagsModalContext = createContext<OpenUnifiedTagsModal | null>(null)

export const useUnifiedTagsModal = () => {
  const localOpen = useContext(UnifiedTagsModalContext)
  const globalOpen = useSetAtom(unifiedTagsModalAtom)

  return localOpen ?? globalOpen
}

export const LocalUnifiedTagsModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [item, setItem] = useState<UnifiedTagsModalProps>(false)

  return (
    <UnifiedTagsModalContext.Provider value={setItem}>
      {children}
      <UnifiedTagsModalInstance item={item} setItem={setItem} />
    </UnifiedTagsModalContext.Provider>
  )
}

export const GlobalUnifiedTagsModal = UnifiedTagsModal
