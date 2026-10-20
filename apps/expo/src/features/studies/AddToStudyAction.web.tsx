import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import ActionItem from '~features/bible/SelectedVersesModal/components/ActionItem'
import { useSelectionMenu } from '~features/bible/SelectedVersesModal/selectionMenuContext'
import type { AddToStudyActionProps } from './AddToStudyAction'
import { useAddToStudyScreens } from './useAddToStudyScreens'

export default function AddToStudyAction({ onPress, onSelect, reference }: AddToStudyActionProps) {
  const { t } = useTranslation()
  const menu = useSelectionMenu()
  const study = useAddToStudyScreens({ onSelect, reference })
  if (!study.available)
    return <ActionItem name="feather" label={t('study.addToStudy')} onPress={onPress} />
  if (menu)
    return (
      <ActionItem
        name="feather"
        label={t('study.addToStudy')}
        onPress={() => menu.openScreen('study')}
        nested
      />
    )
  return (
    <ContextualPanel
      width={400}
      initialScreen="study"
      accessibilityLabel={t('study.addToStudy')}
      onClose={study.reset}
      trigger={
        <Box className="items-center py-2 gap-2 w-[70px]">
          <Box className="items-center justify-center bg-light-grey rounded-[16px] w-[48px] h-[48px]">
            <FeatherIcon name="feather" size={20} color="primary" />
          </Box>
          <Text className="text-[10px]">{t('study.addToStudy')}</Text>
        </Box>
      }
      screens={study.screens}
    />
  )
}
