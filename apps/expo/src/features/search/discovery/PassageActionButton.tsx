import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'

export interface PassageActionButtonProps {
  compare: boolean
  onPress: () => void
}

export default function PassageActionButton({ compare, onPress }: PassageActionButtonProps) {
  const { t } = useTranslation()
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={t(compare ? 'Comparer les versions' : 'Ouvrir dans un nouvel onglet')}
      onPress={onPress}
      className="w-[44px] h-[44px] shrink-0 items-center justify-center rounded-lg bg-light-grey"
    >
      <FeatherIcon name={compare ? 'layers' : 'external-link'} size={18} color="primary" />
    </TouchableBox>
  )
}
