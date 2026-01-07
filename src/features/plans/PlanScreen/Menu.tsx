import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { removePlan, resetPlan } from '~redux/modules/plan'

interface Props {
  modalRefDetails: React.RefObject<BottomSheetModal | null>
  planId: string
}

const Menu = ({ modalRefDetails, planId }: Props) => {
  const router = useRouter()
  const dispatch = useDispatch()
  const { t } = useTranslation()

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
          router.back()
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <>
      <MenuOption onSelect={() => modalRefDetails.current?.present()}>
        <Box row alignItems="center">
          <FeatherIcon name="eye" size={15} />
          <Text marginLeft={10}>{t('Détails')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onResetPress}>
        <Box row alignItems="center">
          <MaterialIcon name="grid-off" size={15} />
          <Text marginLeft={10}>{t('Remise à zéro')}</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onRemovePress}>
        <Box row alignItems="center">
          <MaterialIcon name="cancel" size={17} color="quart" />
          <Text marginLeft={10}>{t('Arrêter le plan')}</Text>
        </Box>
      </MenuOption>
    </>
  )
}

export default Menu
