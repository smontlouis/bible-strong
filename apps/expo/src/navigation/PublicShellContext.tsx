import { createContext, useContext, type ReactNode } from 'react'

type PublicShellContextValue = {
  active: boolean
  openWorkspace: () => void
}

const PublicShellContext = createContext<PublicShellContextValue>({
  active: false,
  openWorkspace: () => undefined,
})

export const PublicShellProvider = ({
  active,
  openWorkspace,
  children,
}: PublicShellContextValue & { children: ReactNode }) => (
  <PublicShellContext.Provider value={{ active, openWorkspace }}>
    {children}
  </PublicShellContext.Provider>
)

export const usePublicShell = () => useContext(PublicShellContext)
