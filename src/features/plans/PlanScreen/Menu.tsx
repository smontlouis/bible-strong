import { type SheetRef } from '~common/sheet'
import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
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
}

const Menu = ({ modalRefDetails, planId, title, onRemove }: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const onResetPress = () => {
    Alert.alert(
      t('Attention'),
      t(
        'Êtes-vous vraiment sur de remettre à zéro votre plan ? Vous perdrez toute votre progression.'
      ),
      [
        { text: t('Annuler'), onPress: () => null, style: 'cancel' },
        {
          text: t('Remettre à zéro'),
          onPress: () => {
            dispatch(resetPlan(planId))
          },
          style: 'destructive',
        },
      ]
    )
  }

  const onRemovePress = () => {
    Alert.alert(t('Attention'), t('Êtes-vous sûr de vouloir arrêter ce plan ?'), [
      { text: t('Annuler'), onPress: () => null, style: 'cancel' },
      {
        text: t('Supprimer'),
        onPress: () => {
          dispatch(removePlan(planId))
          if (onRemove) {
            onRemove()
          } else {
            router.back()
          }
        },
        style: 'destructive',
      },
    ])
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
    <MenuView
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
      <Box row center height={60} width={60}>
        <FeatherIcon name="more-vertical" size={18} />
      </Box>
    </MenuView>
  )
}

export default Menu
