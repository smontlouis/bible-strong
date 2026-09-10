import { goBackOrHome } from '~navigation/goBackOrHome'
import { SheetFooter, type SheetFooterProps, type SheetRef } from '~common/sheet'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import { toast } from '~helpers/toast'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { fetchPlan } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import DetailsModal from '../PlanScreen/DetailsModal'
import { useFireStorage } from '../plan.hooks'
import type { OnlinePlan } from '~common/types'
import type { AppDispatch } from '~redux/store'
type ExplorePlanItemProps = OnlinePlan & {
  featured?: boolean
}

const ExplorePlanItem = ({
  id,
  title,
  downloads,
  description,
  image,
  author,
  type,
  featured,
}: ExplorePlanItemProps) => {
  const router = useRouter()
  const { t } = useTranslation()
  const modalRef = React.useRef<SheetRef>(null)
  const planImage = useFireStorage(image)
  const dispatch = useDispatch<AppDispatch>()
  const hasAlreadyStarted = useSelector(
    (state: RootState) => !!state.plan.myPlans.find(p => id === p.id)
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const r = useMediaQueriesArray()
  const height = r([70, 70, 150, 200])
  const featuredHeight = r([150, 150, 250, 250])

  return (
    <Box className="overflow-hidden border-continuous" style={{ width: featured ? '100%' : '50%' }}>
      <Link onPress={() => modalRef?.current?.present()}>
        <Box
          className="overflow-hidden border-continuous bg-reverse rounded-[20px] m-[10px]"
          style={{
            opacity: hasAlreadyStarted ? 0.5 : 1,
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          }}
        >
          <Box
            className="overflow-hidden border-continuous m-[10px] mb-[0px] bg-light-grey rounded-[15px]"
            style={{ height: featured ? featuredHeight : height }}
          >
            <Image
              style={{
                width: '100%',
                height: featured ? featuredHeight : height,
              }}
              source={{
                uri: planImage,
              }}
            />
          </Box>
          <Box className="overflow-hidden border-continuous px-[15px] pt-[7px] pb-[10px]">
            <Paragraph scale={-2} fontFamily="title" scaleLineHeight={-2}>
              {title}
            </Paragraph>

            {type && (
              <Paragraph
                className="mt-[5px] text-grey"
                scale={-4}
                fontFamily="text"
                scaleLineHeight={-2}
              >
                {type}
              </Paragraph>
            )}
          </Box>
        </Box>
      </Link>
      <DetailsModal
        modalRefDetails={modalRef}
        title={title}
        image={planImage}
        id={id}
        author={author}
        downloads={downloads}
        description={description}
        footer={(props: SheetFooterProps) => (
          <SheetFooter {...props}>
            <Button
              success
              disabled={hasAlreadyStarted || isLoading}
              onPress={() => {
                setIsLoading(true)
                dispatch(fetchPlan({ id, update: true }))
                  .unwrap()
                  .then(() => {
                    setIsLoading(false)
                    goBackOrHome(router)
                    modalRef?.current?.dismiss()
                    toast.success(t('Plan ajouté avec succès'))
                  })
                  .catch((e: unknown) => {
                    console.log('[Plans] Error adding plan:', e)
                    setIsLoading(false)
                    toast.error(
                      t(
                        "Impossible de commencer le téléchargement. Assurez-vous d'être connecté à internet."
                      )
                    )
                  })
              }}
            >
              {hasAlreadyStarted
                ? t('Plan démarré')
                : isLoading
                  ? t('Chargement...')
                  : t('Démarrer ce plan')}
            </Button>
          </SheetFooter>
        )}
      />
    </Box>
  )
}

// export default withNavigation(ExplorePlanItem)
export default ExplorePlanItem
