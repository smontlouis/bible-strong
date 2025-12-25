import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { StackScreenProps } from '@react-navigation/stack'
import React from 'react'
import { ComputedPlanItem } from 'src/common/types'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import Container from '~common/ui/Container'
import { usePrevious } from '~helpers/usePrevious'
import { MainStackProps } from '~navigation/type'
import { useComputedPlan, useFireStorage } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import Menu from './Menu'
import PlanSectionList from './PlanSectionList'
import SuccessModal from './SuccessModal'

const PlanScreen = ({ navigation, route }: StackScreenProps<MainStackProps, 'Plan'>) => {
  const { id, title, image, description, author }: ComputedPlanItem = route.params.plan
  const modalRef = React.useRef<BottomSheetMethods | null>(null)
  const modalRefDetails = React.useRef<BottomSheetModal | null>(null)
  const cacheImage = useFireStorage(image)

  const plan = useComputedPlan(id)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(progress)

  React.useEffect(() => {
    if (progress != null && prevProgress != null && prevProgress !== progress) {
      if (progress > prevProgress) {
        modalRef.current?.expand()
      }
    }
  }, [progress, prevProgress])

  return (
    <Container>
      <Header
        title={title}
        hasBackButton
        rightComponent={
          <PopOverMenu
            popover={<Menu modalRefDetails={modalRefDetails} planId={id} navigation={navigation} />}
          />
        }
      />
      {plan?.sections && <PlanSectionList {...plan} />}
      <SuccessModal modalRef={modalRef} isPlanCompleted={progress === 1} />
      <DetailsModal
        modalRefDetails={modalRefDetails}
        title={title}
        image={cacheImage}
        id={id}
        author={author}
        description={description}
      />
    </Container>
  )
}

export default PlanScreen
