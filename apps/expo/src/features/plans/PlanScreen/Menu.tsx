import { Platform } from 'react-native'
import { hasPlanParticipation } from '../planProgress'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import ReminderSettings from '~features/daily-reading/ReminderSettings'
import ReadingDatePicker from '~features/daily-reading/ReadingDatePicker'
import type { RootState } from '~redux/modules/reducer'
import { type MenuAction } from '~common/ui/MenuView'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useDispatch, useSelector } from 'react-redux'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { removePlan, resetPlan, startPlan, setPlanReminder } from '~redux/modules/plan'
interface Props {
  modalRefDetails: React.RefObject<SheetRef | null>
  planId: string
  title: string
  onRemove?: () => void
  details?: React.ReactNode
  canManageParticipation?: boolean
}

const Menu = ({
  modalRefDetails,
  planId,
  title,
  onRemove,
  details,
  canManageParticipation = true,
}: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const confirm = useConfirmDialog()
  const dateSheet = React.useRef<SheetRef>(null)
  const participation = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(plan => plan.id === planId)
  )
  const started = hasPlanParticipation(participation)
  const startDate = participation?.startDate
  const reminderSheet = React.useRef<SheetRef>(null)
  const reminderControl = (
    <ReminderSettings
      scope={`plan:${planId}`}
      time={participation?.reminderTime}
      onChange={time => dispatch(setPlanReminder({ planId, time }))}
    />
  )
  const dateControl = startDate ? (
    <ReadingDatePicker
      value={startDate}
      label={t('readingPlans.startDate')}
      onChange={date => {
        dispatch(startPlan({ planId, startDate: date }))
        dateSheet.current?.dismiss()
      }}
    />
  ) : null

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
    ...(canManageParticipation && startDate
      ? [
          {
            id: 'start-date',
            title: t('readingPlans.changeStartDate'),
            image: 'calendar' as const,
          },
          ...(Platform.OS !== 'web'
            ? [{ id: 'reminder', title: t('dailyReading.reminder'), image: 'bell' as const }]
            : []),
        ]
      : []),
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
    <>
      <ContextualMenu
        tabActions
        panelTitle={title}
        panelWidth={500}
        icons={{
          details: 'info',
          'start-date': 'calendar',
          reminder: 'bell',
          'open-in-new-tab': 'external-link',
          reset: 'rotate-ccw',
          remove: 'trash-2',
        }}
        screens={{
          ...(Platform.OS !== 'web' && canManageParticipation && startDate
            ? { reminder: { title: t('dailyReading.reminder'), content: () => reminderControl } }
            : {}),
          ...(details ? { details: { title: t('Détails'), content: () => details } } : {}),
          ...(canManageParticipation && startDate
            ? {
                'start-date': {
                  title: t('readingPlans.changeStartDate'),
                  content: () => dateControl,
                },
              }
            : {}),
        }}
        actions={
          canManageParticipation && started
            ? actions
            : actions.filter(action => !['reset', 'remove'].includes(action.id ?? ''))
        }
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
            case 'reminder':
              reminderSheet.current?.present()
              break
            case 'start-date':
              dateSheet.current?.present()
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
      {Platform.OS !== 'web' && (
        <Sheet ref={reminderSheet} modalTitle={t('dailyReading.reminder')}>
          <SheetView className="p-[20px]">{reminderControl}</SheetView>
        </Sheet>
      )}
      <Sheet ref={dateSheet} modalTitle={t('readingPlans.changeStartDate')}>
        <SheetView className="p-[20px]">{dateControl}</SheetView>
      </Sheet>
    </>
  )
}

export default Menu
