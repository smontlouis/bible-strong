import BottomSheet from '@gorhom/bottom-sheet'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { NavigationParams } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { removePlan, resetPlan } from '~redux/modules/plan'

interface Props {
  modalRefDetails: React.RefObject<BottomSheet>
  planId: string
  navigation: NavigationStackProp<any, NavigationParams>
}

const Menu = ({ modalRefDetails, planId, navigation }: Props) => {
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
    Alert.alert(
      t('Attention'),
      t('Êtes-vous sûr de vouloir arrêter ce plan ?'),
      [
        { text: t('Annuler'), onPress: () => null, style: 'cancel' },
        {
          text: t('Supprimer'),
          onPress: () => {
            dispatch(removePlan(planId))
            navigation.goBack()
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <>
      <MenuOption onSelect={() => modalRefDetails.current?.expand()}>
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
