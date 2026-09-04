import { HiArrowLeft } from 'react-icons/hi'
import type { ButtonHTMLAttributes } from 'react'

const GoBackArrow = (props: ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      onClick={() => window.history.back()}
      className="text-primary"
      aria-label="Retour"
      {...props}
    ><HiArrowLeft className="size-9" /></button>
  )
}

export default GoBackArrow
