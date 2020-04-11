import React from 'react'
import { NavigationStackProp } from 'react-navigation-stack'
import { Modalize } from 'react-native-modalize'

import Container from '~common/ui/Container'
import Header from '~common/Header'
import { ComputedPlanItem } from 'src/common/types'
import PlanSectionList from './PlanSectionList'
import { useComputedPlan } from '../plan.hooks'
import { usePrevious } from '~helpers/usePrevious'
import SuccessModal from './SuccessModal'

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
  const modalRef = React.useRef<Modalize>(null)
  const plan = useComputedPlan(id)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(
    progress
  )

  React.useEffect(() => {
    if (!!prevProgress && !!progress && prevProgress !== progress) {
      if (progress > prevProgress) {
        console.log('upgrade')
        modalRef.current?.open()
      } else {
        console.log('downgrade')
      }
    }
  }, [progress, prevProgress])

  return (
    <Container>
      <Header title={title} hasBackButton />
      {plan?.sections && <PlanSectionList {...plan} />}
      <SuccessModal modalRef={modalRef} isPlanCompleted={progress === 1} />
    </Container>
  )
}

export default PlanScreen
