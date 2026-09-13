import { goBackOrHome } from '~navigation/goBackOrHome'
import { type SheetRef } from '~common/sheet'
import { type MenuAction } from '~common/ui/MenuView'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useDispatch } from 'react-redux'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { removePlan, resetPlan } from '~redux/modules/plan'
interface Props {
  modalRefDetails: React.RefObject<SheetRef | null>
  planId: string
  title: string
  onRemove?: () => void
  details?: React.ReactNode
}

const Menu = ({ modalRefDetails, planId, title, onRemove, details }: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const confirm = useConfirmDialog()

  const onResetPress = async () => {
    if (
      await confirm({
        title: t('Attention'),
        message: t(
          'Êtes-vous vraiment sur de remettre à zéro votre plan ? Vous perdrez toute votre progression.'
        ),
        cancelLabel: t('Annuler'),
        confirmLabel: t('Remettre à zéro'),
        destructive: true,
      })
    )
      dispatch(resetPlan(planId))
  }

  const onRemovePress = async () => {
    if (
      await confirm({
        title: t('Attention'),
        message: t('Êtes-vous sûr de vouloir arrêter ce plan ?'),
        cancelLabel: t('Annuler'),
        confirmLabel: t('Supprimer'),
        destructive: true,
      })
    ) {
      dispatch(removePlan(planId))
      if (onRemove) onRemove()
      else goBackOrHome(router)
    }
  }

  const actions: MenuAction[] = [
    {
      id: 'details',
      title: t('Détails'),
      image: 'info.circle',
    },
    {
      id: 'open-in-new-tab',
      title: t('tab.openInNewTab'),
      image: 'arrow.up.forward.square',
    },
    {
      id: 'reset',
      title: t('Remise à zéro'),
      image: 'clock.arrow.circlepath',
    },
    {
      id: 'remove',
      title: t('Arrêter le plan'),
      image: 'trash',
      attributes: { destructive: true },
    },
  ]

  return (
    <ContextualMenu
      tabActions
      panelTitle={title}
      panelWidth={500}
      icons={{
        details: 'info',
        'open-in-new-tab': 'external-link',
        reset: 'rotate-ccw',
        remove: 'trash-2',
      }}
      screens={details ? { details: { title: t('Détails'), content: () => details } } : {}}
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        switch (nativeEvent.event) {
          case 'details':
            modalRefDetails.current?.present()
            break
          case 'open-in-new-tab':
            openInNewTab({
              id: `plan-${generateUUID()}`,
              title,
              isRemovable: true,
              type: 'plan',
              data: { planId },
            })
            break
          case 'reset':
            onResetPress()
            break
          case 'remove':
            onRemovePress()
            break
        }
      }}
    >
      <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
        <FeatherIcon name="more-vertical" size={18} />
      </Box>
    </ContextualMenu>
  )
}

export default Menu
