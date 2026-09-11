import { useTranslation } from 'react-i18next'
import { FeatherIcon } from '~common/ui/Icon'
import type { PassageActionButtonProps } from './PassageActionButton'

export default function PassageActionButton({ compare, onPress }: PassageActionButtonProps) {
  const { t } = useTranslation()
  const label = t(compare ? 'Comparer les versions' : 'Ouvrir dans un nouvel onglet')
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onPress}
      className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-lg border-0 p-0 cursor-pointer bg-transparent opacity-60 hover:bg-light-grey hover:opacity-100 focus-visible:bg-light-grey focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <FeatherIcon name={compare ? 'layers' : 'external-link'} size={17} color="primary" />
    </button>
  )
}
