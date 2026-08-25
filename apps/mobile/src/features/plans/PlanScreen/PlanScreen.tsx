import { type SheetRef } from '~common/sheet'
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ComputedReadingSlice, ComputedPlanItem, Plan } from 'src/common/types'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { usePrevious } from '~helpers/usePrevious'
import { useComputedPlan, useFireStorage } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import Menu from './Menu'
import PlanSectionList from './PlanSectionList'
import SuccessModal from './SuccessModal'

interface Props {
  planId?: string
  hasBackButton?: boolean
  onReadingSlicePress?: (
    slice: ComputedReadingSlice & { planId: string; planTitle: string; planLanguage?: Plan['lang'] }
  ) => void
  onRemove?: () => void
}

const PlanScreen = ({
  planId: planIdFromProps,
  hasBackButton = true,
  onReadingSlicePress,
  onRemove,
}: Props) => {
  const params = useLocalSearchParams<{ plan?: string }>()

  // Parse complex object from URL string
  const planParams: ComputedPlanItem | undefined = params.plan ? JSON.parse(params.plan) : undefined
  const id = planIdFromProps || planParams?.id || ''
  const modalRef = React.useRef<SheetRef | null>(null)
  const modalRefDetails = React.useRef<SheetRef | null>(null)

  const plan = useComputedPlan(id)
  const {
    title = planParams?.title,
    image = planParams?.image,
    description = planParams?.description,
    author = planParams?.author,
  } = plan || {}
  const cacheImage = useFireStorage(image)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(progress)
  const isPlanCompleted = progress === 1

  React.useEffect(() => {
    if (progress != null && prevProgress != null && prevProgress !== progress) {
      if (progress > prevProgress) {
        modalRef.current?.present()
      }
    }
  }, [progress, prevProgress])

  return (
    <Container>
      <Header
        title={title}
        hasBackButton={hasBackButton}
        rightComponent={
          <Menu
            modalRefDetails={modalRefDetails}
            planId={id}
            title={title || ''}
            onRemove={onRemove}
          />
        }
      />
      {plan?.sections && <PlanSectionList {...plan} onReadingSlicePress={onReadingSlicePress} />}
      <SuccessModal modalRef={modalRef} isPlanCompleted={isPlanCompleted} />
      <DetailsModal
        modalRefDetails={modalRefDetails}
        title={title || ''}
        image={cacheImage}
        id={id}
        author={author || { id: '', displayName: '', photoUrl: '' }}
        description={description}
      />
    </Container>
  )
}

export default PlanScreen
