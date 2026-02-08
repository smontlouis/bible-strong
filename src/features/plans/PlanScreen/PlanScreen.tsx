import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ComputedPlanItem } from 'src/common/types'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import Container from '~common/ui/Container'
import { usePrevious } from '~helpers/usePrevious'
import { useAppRating } from '~features/app-rating/useAppRating'
import RatingPrompt from '~features/app-rating/RatingPrompt'
import { useComputedPlan, useFireStorage } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import Menu from './Menu'
import PlanSectionList from './PlanSectionList'
import SuccessModal from './SuccessModal'

const PlanScreen = () => {
  const params = useLocalSearchParams<{ plan?: string }>()

  // Parse complex object from URL string
  const planParams: ComputedPlanItem | undefined = params.plan ? JSON.parse(params.plan) : undefined
  const { id, title, image, description, author } = planParams || ({} as ComputedPlanItem)
  const modalRef = React.useRef<BottomSheetMethods | null>(null)
  const ratingModalRef = React.useRef<BottomSheetMethods | null>(null)
  const modalRefDetails = React.useRef<BottomSheetModal | null>(null)
  const cacheImage = useFireStorage(image)

  const plan = useComputedPlan(id)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(progress)
  const isPlanCompleted = progress === 1
  const { shouldShowRatingPrompt, trackPlanCompleted } = useAppRating()

  React.useEffect(() => {
    if (progress != null && prevProgress != null && prevProgress !== progress) {
      if (progress > prevProgress) {
        modalRef.current?.expand()
      }
    }
  }, [progress, prevProgress])

  // Track plan completion and potentially show rating prompt
  const handleSuccessModalClose = () => {
    if (isPlanCompleted) {
      trackPlanCompleted()
      // Small delay so the success modal finishes closing
      setTimeout(() => {
        if (shouldShowRatingPrompt('plan_completed')) {
          ratingModalRef.current?.expand()
        }
      }, 500)
    }
  }

  return (
    <Container>
      <Header
        title={title}
        hasBackButton
        rightComponent={
          <PopOverMenu popover={<Menu modalRefDetails={modalRefDetails} planId={id} />} />
        }
      />
      {plan?.sections && <PlanSectionList {...plan} />}
      <SuccessModal
        modalRef={modalRef}
        isPlanCompleted={isPlanCompleted}
        onClose={handleSuccessModalClose}
      />
      <RatingPrompt modalRef={ratingModalRef} />
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
