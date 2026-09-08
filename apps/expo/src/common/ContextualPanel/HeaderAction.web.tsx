import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderActionContext } from './HeaderActionContext'
export default function HeaderAction({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActionContext)
  return target ? createPortal(children, target) : null
}
