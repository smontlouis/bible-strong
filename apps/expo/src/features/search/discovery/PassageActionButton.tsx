import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
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
      className="w-[40px] h-[40px] shrink-0 items-center justify-center"
    >
      <Box className="w-[32px] h-[32px] items-center justify-center rounded-lg bg-light-grey">
        <FeatherIcon name={compare ? 'layers' : 'external-link'} size={15} color="primary" />
      </Box>
    </TouchableBox>
  )
}
