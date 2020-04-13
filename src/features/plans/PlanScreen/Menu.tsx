import React from 'react'
import { Alert } from 'react-native'
import { Modalize } from 'react-native-modalize'
import { MenuOption } from 'react-native-popup-menu'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { resetPlan } from '~redux/modules/plan'

interface Props {
  modalRefDetails: React.RefObject<Modalize<any, any>>
  planId: string
}

const Menu = ({ modalRefDetails, planId }: Props) => {
  const dispatch = useDispatch()

  const onResetPress = () => {
    Alert.alert(
      'Attention',
      'Êtes-vous vraiment sur de remettre à zéro votre plan ? Vous perdrez toute votre progression.',
      [
        { text: 'Annuler', onPress: () => null, style: 'cancel' },
        {
          text: 'Effacer',
          onPress: () => {
            dispatch(resetPlan(planId))
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <>
      <MenuOption onSelect={() => modalRefDetails.current?.open()}>
        <Box row alignItems="center">
          <FeatherIcon name="eye" size={20} />
          <Text marginLeft={10}>Détails</Text>
        </Box>
      </MenuOption>
      <MenuOption onSelect={onResetPress}>
        <Box row alignItems="center">
          <MaterialIcon name="grid-off" size={20} />
          <Text marginLeft={10}>Remise à zéro</Text>
        </Box>
      </MenuOption>
    </>
  )
}

export default Menu
