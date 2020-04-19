import React from 'react'
import { Modalize } from 'react-native-modalize'
import { MenuOption } from 'react-native-popup-menu'
import { NavigationStackProp } from 'react-navigation-stack'
import { useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import { ComputedReadingSlice, EntitySlice } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import chapterToReference from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import { markAsRead } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import ParamsModal from './ParamsModal'
import PauseText from './PauseText'
import ReadButton from './ReadButton'
import Slice from './Slice'

interface Props {
  navigation: NavigationStackProp<{ readingSlice: ComputedReadingSlice }>
}

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

const PlanSliceScreen = ({ navigation }: Props) => {
  const {
    id,
    title,
    planId,
    slices,
  }: ComputedReadingSlice & { planId: string } = navigation.getParam(
    'readingSlice',
    {}
  )
  const dispatch = useDispatch()
  const paramsModalRef = React.useRef<Modalize>(null)

  const isRead = useSelector(
    (state: RootState) =>
      state.plan.ongoingPlans.find(oP => oP.id === planId)?.readingSlices[
        id
      ] === 'Completed'
  )
  const version = useSelector((state: RootState) => state.bible.selectedVersion)

  const onMarkAsReadSelect = () => {
    dispatch(markAsRead({ readingSliceId: id, planId }))
    navigation.goBack()
  }

  const mainSlice: EntitySlice | undefined = slices.find(
    s => s.type === 'Chapter' || s.type === 'Verse'
  )
  const sliceTitle = mainSlice ? extractTitle(mainSlice) : ''
  return (
    <Container>
      <Header
        title={sliceTitle}
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
                <MenuOption onSelect={onMarkAsReadSelect}>
                  <Box row alignItems="center">
                    <MaterialIcon
                      name="check"
                      size={20}
                      color="success"
                      style={{ opacity: isRead ? 0.3 : 1 }}
                    />
                    <Text marginLeft={10}>
                      {isRead ? 'Marquer comme non lu' : 'Marquer comme lu'}
                    </Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() =>
                    navigation.navigate({
                      routeName: 'VersionSelector',
                      params: { version },
                    })
                  }
                >
                  <Box row alignItems="center">
                    <TextIcon style={{ fontSize: 12 }}>{version}</TextIcon>
                    <Text marginLeft={10}>Changer de version</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={() => paramsModalRef.current?.open()}>
                  <Box row alignItems="center">
                    <TextIcon>Aa</TextIcon>
                    <Text marginLeft={10}>Mise en forme</Text>
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
              Vous avez déjà terminé cette lecture.
            </Paragraph>
          </Box>
        )}
        <PauseText>
          {
            'Prenez une grande inspiration,\n alors que vous vous apprêtez à passer du\n temps avec Dieu'
          }
        </PauseText>
        {title && (
          <Box paddingHorizontal={20} marginBottom={50}>
            <Paragraph scale={3}>{title}</Paragraph>
          </Box>
        )}
        {slices.map(slice => (
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
