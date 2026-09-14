import { useRef } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { ComputedReadingSlice, Plan } from '~common/types'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import type { SheetRef } from '~common/sheet'
import { useComputedPlan, useFireStorage } from '~features/plans/plan.hooks'
import { getEditorialKind } from '~features/plans/readingCalendar'
import MeditationCollectionContent from '~features/plans/PlanScreen/MeditationCollectionContent'
import DetailsModal from '~features/plans/PlanScreen/DetailsModal'
import Menu from '~features/plans/PlanScreen/Menu'
import { useReadingContent } from './useDailyMeditation'

interface Props {
  collectionId?: string
  hasBackButton?: boolean
  onReadingSlicePress?: (
    reading: ComputedReadingSlice & {
      planId: string
      planTitle: string
      planLanguage?: Plan['lang']
      meditationDate?: string
    }
  ) => void
}
export default function MeditationCollectionScreen({
  collectionId: requestedId,
  hasBackButton = true,
  onReadingSlicePress,
}: Props) {
  const params = useLocalSearchParams<{ collectionId?: string }>()
  const id = requestedId ?? params.collectionId ?? ''
  const { t } = useTranslation()
  const { isError, retry } = useReadingContent(id)
  const collection = useComputedPlan(id)
  const image = useFireStorage(collection?.image)
  const details = useRef<SheetRef>(null)
  const title = collection?.title ?? t('dailyReading.collection') ?? ''
  return (
    <Container>
      <Header
        title={title}
        hasBackButton={hasBackButton}
        rightComponent={
          collection && (
            <Menu
              modalRefDetails={details}
              planId={id}
              title={title}
              canManageParticipation={false}
              details={
                <DetailsModal
                  inline
                  id={id}
                  title={title}
                  image={image}
                  author={collection.author}
                  description={collection.description}
                />
              }
            />
          )
        }
      />
      {!collection && !isError && <Loading />}
      {!collection && isError && (
        <Box className="p-[20px] gap-[16px]">
          <Text className="text-grey">{t('dailyReading.downloadError')}</Text>
          <Button
            onPress={() => {
              void retry()
            }}
          >
            {t('dailyReading.retry')}
          </Button>
        </Box>
      )}
      {collection && getEditorialKind(collection) === 'daily-meditation' && (
        <MeditationCollectionContent plan={collection} onReadingSlicePress={onReadingSlicePress} />
      )}
      {collection && (
        <DetailsModal
          modalRefDetails={details}
          id={id}
          title={title}
          image={image}
          author={collection.author}
          description={collection.description}
        />
      )}
    </Container>
  )
}
