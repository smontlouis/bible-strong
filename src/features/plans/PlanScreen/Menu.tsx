import React from 'react'
import { Alert } from 'react-native'
import { Modalize } from 'react-native-modalize'
import { MenuOption } from 'react-native-popup-menu'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { resetPlan, removePlan } from '~redux/modules/plan'
import { NavigationStackProp } from 'react-navigation-stack'
import { NavigationParams } from 'react-navigation'

interface Props {
  modalRefDetails: React.RefObject<Modalize>
  planId: string
  navigation: NavigationStackProp<any, NavigationParams>
}

const Menu = ({ modalRefDetails, planId, navigation }: Props) => {
  const dispatch = useDispatch()

  const onResetPress = () => {
    Alert.alert(
      'Attention',
      'Êtes-vous vraiment sur de remettre à zéro votre plan ? Vous perdrez toute votre progression.',
      [
        { text: 'Annuler', onPress: () => null, style: 'cancel' },
        {
          text: 'Remettre à zéro',
          onPress: () => {
            dispatch(resetPlan(planId))
          },
          style: 'destructive',
        },
      ]
    )
  }

  const onRemovePress = () => {
    Alert.alert('Attention', 'Êtes-vous sûr de vouloir arrêter ce plan ?', [
      { text: 'Annuler', onPress: () => null, style: 'cancel' },
      {
        text: 'Supprimer',
        onPress: () => {
          dispatch(removePlan(planId))
          navigation.goBack()
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <>
      <MenuOption onSelect={() => modalRefDetails.current?.open()}>
        <Box row alignItems="center">
          <FeatherIcon name="eye" size={15} />
          <Text marginLeft={10}>Détails</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onResetPress}>
        <Box row alignItems="center">
          <MaterialIcon name="grid-off" size={15} />
          <Text marginLeft={10}>Remise à zéro</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onRemovePress}>
        <Box row alignItems="center">
          <MaterialIcon name="cancel" size={17} color="quart" />
          <Text marginLeft={10}>Arrêter le plan</Text>
        </Box>
      </MenuOption>
    </>
  )
}

export default Menu
