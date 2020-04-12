import React from 'react'
import { NavigationStackProp } from 'react-navigation-stack'
import { Modalize } from 'react-native-modalize'
import { MenuOption } from 'react-native-popup-menu'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import { MaterialIcon, FeatherIcon } from '~common/ui/Icon'
import { ComputedPlanItem } from 'src/common/types'
import PlanSectionList from './PlanSectionList'
import { useComputedPlan } from '../plan.hooks'
import { usePrevious } from '~helpers/usePrevious'
import SuccessModal from './SuccessModal'
import { Alert } from 'react-native'
import { resetPlan } from '~redux/modules/plan'
import { useDispatch } from 'react-redux'
import DetailsModal from './DetailsModal'

interface Props {
  navigation: NavigationStackProp<{ plan: ComputedPlanItem }>
}

const PlanScreen = ({ navigation }: Props) => {
  const {
    id,
    title,
    image,
    description,
    author,
  }: ComputedPlanItem = navigation.getParam('plan', {})
  const dispatch = useDispatch()
  const modalRef = React.useRef<Modalize>(null)
  const modalRefDetails = React.useRef<Modalize>(null)

  const plan = useComputedPlan(id)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(
    progress
  )

  React.useEffect(() => {
    if (progress != null && prevProgress != null && prevProgress !== progress) {
      if (progress > prevProgress) {
        modalRef.current?.open()
      }
    }
  }, [progress, prevProgress])

  const onResetPress = () => {
    Alert.alert(
      'Attention',
      'Êtes-vous vraiment sur de remettre à zéro votre plan ? Vous perdrez toute votre progression.',
      [
        { text: 'Annuler', onPress: () => null, style: 'cancel' },
        {
          text: 'Effacer',
          onPress: () => {
            dispatch(resetPlan(id))
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <Container>
      <Header
        title={title}
        hasBackButton
        rightComponent={
          <PopOverMenu
            element={
              <Box
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                height={50}
                width={50}
              >
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            }
            popover={
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
            }
          />
        }
      />
      {plan?.sections && <PlanSectionList {...plan} />}
      <SuccessModal modalRef={modalRef} isPlanCompleted={progress === 1} />
      <DetailsModal
        modalRefDetails={modalRefDetails}
        title={title}
        image={image}
        id={id}
        author={author}
        description={description}
      />
    </Container>
  )
}

export default PlanScreen
