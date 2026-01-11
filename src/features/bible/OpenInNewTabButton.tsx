import { useTranslation } from 'react-i18next'
import { BibleTab } from 'src/state/tabs'
import generateUUID from '~helpers/generateUUID'
import Button from '~common/ui/Button'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

interface OpenInNewTabButtonProps {
  bibleTab: BibleTab
}

export const OpenInNewTabButton = ({ bibleTab }: OpenInNewTabButtonProps) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const openInBibleTab = () => {
    openInNewTab({
      ...bibleTab,
      id: `bible-${generateUUID()}`,
      data: {
        ...bibleTab.data,
        isReadOnly: true,
      },
    })
  }
  return (
    <Button
      onPress={openInBibleTab}
      style={{
        marginTop: 5,
        marginBottom: 5,
        width: 270,
      }}
    >
      {t('tab.openInNewTab')}
    </Button>
  )
}
