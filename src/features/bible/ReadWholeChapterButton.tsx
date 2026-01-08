import { useTranslation } from 'react-i18next'
import Button from '~common/ui/Button'

interface ReadWholeChapterButtonProps {
  onPress: () => void
}

export const ReadWholeChapterButton = ({ onPress }: ReadWholeChapterButtonProps) => {
  const { t } = useTranslation()

  return (
    <Button
      onPress={onPress}
      style={{
        marginTop: 5,
        marginBottom: 5,
        width: 270,
      }}
    >
      {t('tab.readWholeChapter')}
    </Button>
  )
}
