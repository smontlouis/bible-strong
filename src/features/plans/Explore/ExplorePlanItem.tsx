import React from 'react'
import FastImage from 'react-native-fast-image'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { withNavigation, NavigationParams } from 'react-navigation'
import SnackBar from '~common/SnackBar'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import { OnlinePlan } from '~common/types'
import Paragraph from '~common/ui/Paragraph'
import { Modalize } from 'react-native-modalize'
import DetailsModal from '../PlanScreen/DetailsModal'
import { Portal } from 'react-native-paper'
import { useFireStorage } from '../plan.hooks'
import Button from '~common/ui/Button'
import { fetchPlan } from '~redux/modules/plan'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { NavigationStackProp } from 'react-navigation-stack'

const ExplorePlanItem = ({
  id,
  title,
  downloads,
  description,
  image,
  author,
  type,
  navigation,
  featured,
}: OnlinePlan & { navigation: NavigationStackProp<any, NavigationParams> }) => {
  const modalRef = React.useRef<Modalize>(null)
  const planImage = useFireStorage(image)
  const dispatch = useDispatch()
  const hasAlreadyStarted = useSelector(
    (state: RootState) => !!state.plan.myPlans.find(p => id === p.id)
  )
  const [isLoading, setIsLoading] = React.useState(false)

  return (
    <Box width={featured ? '100%' : '50%'}>
      <Link onPress={() => modalRef?.current?.open()}>
        <Box
          lightShadow
          borderRadius={20}
          margin={10}
          opacity={hasAlreadyStarted ? 0.5 : 1}
        >
          <Box
            margin={10}
            marginBottom={0}
            height={featured ? 150 : 80}
            backgroundColor="lightGrey"
            borderRadius={15}
          >
            <FastImage
              style={{ width: '100%', height: featured ? 150 : 80 }}
              source={{
                uri: planImage,
              }}
            />
          </Box>
          <Box paddingHorizontal={15} paddingTop={7} paddingBottom={10}>
            <Paragraph scale={-2} fontFamily="title" scaleLineHeight={-2}>
              {title}
            </Paragraph>

            {type && (
              <Paragraph
                marginTop={5}
                scale={-4}
                color="grey"
                fontFamily="text"
                scaleLineHeight={-2}
              >
                {type}
              </Paragraph>
            )}
          </Box>
        </Box>
      </Link>
      <Portal>
        <DetailsModal
          modalRefDetails={modalRef}
          title={title}
          image={planImage}
          id={id}
          author={author}
          downloads={downloads}
          description={description}
          FooterComponent={
            <Box
              paddingBottom={10 + getBottomSpace()}
              paddingHorizontal={20}
              paddingTop={10}
            >
              <Button
                success
                disabled={hasAlreadyStarted || isLoading}
                onPress={() => {
                  setIsLoading(true)
                  dispatch(fetchPlan({ id, update: true }))
                    .then(() => {
                      setIsLoading(false)
                      navigation.goBack()
                      modalRef?.current?.close()
                      SnackBar.show('Plan ajouté avec succès')
                    })
                    .catch(e => {
                      console.log(e)
                      setIsLoading(false)
                      SnackBar.show(
                        "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet.",
                        'danger'
                      )
                    })
                }}
              >
                {hasAlreadyStarted
                  ? 'Plan démarré'
                  : isLoading
                  ? 'Chargement...'
                  : 'Démarrer ce plan'}
              </Button>
            </Box>
          }
        />
      </Portal>
    </Box>
  )
}

export default withNavigation(ExplorePlanItem)
