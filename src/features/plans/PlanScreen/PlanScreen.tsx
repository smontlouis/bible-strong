import React from 'react'
import { Modalize } from 'react-native-modalize'
import { NavigationStackProp } from 'react-navigation-stack'
import { ComputedPlanItem } from 'src/common/types'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { usePrevious } from '~helpers/usePrevious'
import { useComputedPlan } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import PlanSectionList from './PlanSectionList'
import SuccessModal from './SuccessModal'
import Menu from './Menu'
import { useFireStorage } from '../plan.hooks'

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
  const modalRefDetails = React.useRef<Modalize>(null)
  const cacheImage = useFireStorage(image)

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
              <Menu
                modalRefDetails={modalRefDetails}
                planId={id}
                navigation={navigation}
              />
            }
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
