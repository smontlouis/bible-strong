import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isFullScreenBibleAtom } from 'src/state/app'
import { BibleTab } from 'src/state/tabs'
import { AnimatedBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'

interface OpenInNewTabButtonProps {
  bibleTab: BibleTab
}

export const OpenInNewTabButton = ({ bibleTab }: OpenInNewTabButtonProps) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const insets = useSafeAreaInsets()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)

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
    <AnimatedBox
      center
      paddingBottom={insets.bottom}
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      style={{
        transform: [{ translateY: isFullScreenBible ? HEADER_HEIGHT + insets.bottom + 20 : 0 }],
        transitionProperty: 'transform',
        transitionDuration: 300,
      }}
    >
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
    </AnimatedBox>
  )
}
