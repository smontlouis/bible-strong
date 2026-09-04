import { FiChevronLeft } from 'react-icons/fi'

export const PreviousButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button className="rounded-full bg-primary p-2 text-primary-foreground" onClick={onClick} aria-label="Précédent"><FiChevronLeft className="size-[18px]" /></button>
  )
}

export default PreviousButton
