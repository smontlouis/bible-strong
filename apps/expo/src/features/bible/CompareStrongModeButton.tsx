import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import StrongMark from './StrongMark'
type CompareStrongModeButtonProps = {
  enabled: boolean
  onPress: () => void
  height?: number
}

const CompareStrongModeButton = ({
  enabled,
  onPress,
  height = 54,
}: CompareStrongModeButtonProps) => {
  const { t } = useTranslation()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous w-[44px] items-center justify-center"
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={t('Mode Strong')}
      accessibilityState={{ checked: enabled }}
      style={{ height: height }}
    >
      <StrongMark highlighted={enabled} />
    </TouchableBox>
  )
}

export default CompareStrongModeButton
