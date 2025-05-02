import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import MenuOption from '~common/ui/MenuOption'

import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Share } from 'react-native'
import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import { ComputedReadingSlice, EntitySlice } from '~common/types'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import chapterToReference from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { markAsRead } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { defaultBibleAtom } from '../../../state/tabs'
import ParamsModal from './ParamsModal'
import PauseText from './PauseText'
import ReadButton from './ReadButton'
import Slice from './Slice'
import { chapterSliceToText, verseSliceToText, videoSliceToText } from './share'
import BottomSheet from '@gorhom/bottom-sheet'
import { StackScreenProps } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import { timeout } from '~helpers/timeout'

const extractTitle = (slice: EntitySlice) => {
  switch (slice.type) {
    case 'Verse':
      return verseToReference(slice.verses, { isPlan: true })
    case 'Chapter':
      return chapterToReference(slice.chapters)
    default:
      return ''
  }
}

const PlanSliceScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'PlanSlice'>) => {
  const { id, title, slices, planId } = route.params.readingSlice || {}

  const { t } = useTranslation()
  const dispatch = useDispatch()
  const paramsModalRef = React.useRef<BottomSheet>(null)

  const isRead = useSelector(
    (state: RootState) =>
      state.plan.ongoingPlans.find((oP) => oP.id === planId)?.readingSlices[
        id
      ] === 'Completed'
  )
  const [bible] = useAtom(defaultBibleAtom)
  const { openVersionSelector } = useBookAndVersionSelector()
  const { selectedVersion: version } = bible.data

  const onMarkAsReadSelect = () => {
    dispatch(markAsRead({ readingSliceId: id, planId }))
    navigation.goBack()
  }

  const mainSlice: EntitySlice | undefined = slices.find(
    (s) => s.type === 'Chapter' || s.type === 'Verse'
  )
  const sliceTitle = mainSlice ? extractTitle(mainSlice) : ''

  const share = async () => {
    const textSlices = await Promise.all(
      slices.map(async (slice) => {
        switch (slice.type) {
          case 'Chapter': {
            return await chapterSliceToText(slice, version)
          }
          case 'Verse': {
            return await verseSliceToText(slice, version)
          }
          case 'Video': {
            return await videoSliceToText(slice)
          }
          case 'Title': {
            return slice.title
          }
          case 'Text': {
            return `${slice.description}`
          }
          case 'Image':
          default: {
            return ''
          }
        }
      })
    )

    try {
      const message = `${sliceTitle || title}\n\n${textSlices.join('\n\n')}`
      await timeout(400)
      Share.share({ message })
    } catch (e) {
      Snackbar.show('Erreur lors du partage.')
      console.log(e)
    }
  }

  return (
    <Container>
      <Header
        title={sliceTitle}
        hasBackButton
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption onSelect={onMarkAsReadSelect}>
                  <Box row alignItems="center">
                    <MaterialIcon
                      name="check"
                      size={20}
                      color="success"
                      style={{ opacity: isRead ? 0.3 : 1 }}
                    />
                    <Text marginLeft={10}>
                      {isRead
                        ? t('Marquer comme non lu')
                        : t('Marquer comme lu')}
                    </Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => openVersionSelector(defaultBibleAtom)}
                >
                  <Box row alignItems="center">
                    <TextIcon style={{ fontSize: 12 }}>{version}</TextIcon>
                    <Text marginLeft={10}>{t('Changer de version')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={() => paramsModalRef.current?.expand()}>
                  <Box row alignItems="center">
                    <TextIcon>Aa</TextIcon>
                    <Text marginLeft={10}>{t('Mise en forme')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={share}>
                  <Box row alignItems="center">
                    <FeatherIcon
                      name="share-2"
                      size={17}
                      onPress={share}
                      style={{ marginRight: 10 }}
                    />
                    <Text marginLeft={10}>{t('Partager')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView>
        {isRead && (
          <Box
            opacity={0.6}
            backgroundColor="success"
            borderRadius={30}
            padding={20}
            marginHorizontal={20}
            center
            row
          >
            <FeatherIcon name="check" size={20} color="reverse" />
            <Paragraph
              marginLeft={5}
              color="reverse"
              scale={-2}
              fontFamily="text"
              bold
            >
              {t('Vous avez déjà terminé cette lecture.')}
            </Paragraph>
          </Box>
        )}
        <PauseText>
          {t(
            'Prenez une grande inspiration,\n alors que vous vous apprêtez à passer du\n temps avec Dieu'
          )}
        </PauseText>
        {title && (
          <Box paddingHorizontal={20} marginBottom={50}>
            <Paragraph scale={3}>{title}</Paragraph>
          </Box>
        )}
        {slices.map((slice) => (
          <Slice key={slice.id} {...slice} />
        ))}
        <Box height={80} center marginTop={30}>
          <ReadButton isRead={isRead} readingSliceId={id} planId={planId} />
        </Box>
      </ScrollView>
      <ParamsModal paramsModalRef={paramsModalRef} />
    </Container>
  )
}

export default PlanSliceScreen
