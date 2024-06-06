import React, { useState, useEffect, useRef } from 'react'
import { View } from 'react-native'
import styled from '@emotion/native'
import { useTheme, withTheme } from '@emotion/react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import compose from 'recompose/compose'

import waitForStrongDB from '~common/waitForStrongDB'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import verseToStrong from '~helpers/verseToStrong'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { useTranslation, withTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { CarouselProvider } from '~helpers/CarouselContext'
import { hp, wp } from '~helpers/utils'
import { StrongReference, Verse } from '~common/types'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
    flex: 1,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    flexDirection: 'row',
}))

const VersetWrapper = styled.View(() => ({
    width: 25,
    marginRight: 5,
    borderRightWidth: 3,
    borderRightColor: 'transparent',
    alignItems: 'flex-end',
}))

const NumberText = styled(Paragraph)({
    marginTop: 0,
    fontSize: 9,
    justifyContent: 'flex-end',
    marginRight: 3,
})

const StyledVerse = styled.View(({ theme }) => ({
    paddingLeft: 0,
    paddingRight: 10,
    marginBottom: 5,
    flexDirection: 'row',
}))

const CountChip = styled.View(({ theme }) => ({
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.border,
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    bottom: -5,
    right: -5,
}))

const StyledScrollView = styled.ScrollView(({ theme }) => ({
    backgroundColor: theme.colors.lightGrey,
}))

type Props = {
    verse: Verse
    isSelectionMode: boolean
    updateVerse: (incr: number) => void
};

const BibleVerseDetailCard = (props: Props) => {
    const navigation = useNavigation<StackNavigationProp<MainStackProps>>()
    const theme = useTheme()

    const [error, setError] = useState(false)
    const [versesInCurrentChapter, setVersesInCurrentChapter] = useState<number>()
    const [formattedTexte, setFormattedTexte] = useState<string>()
    const [isCarouselLoading, setIsCarouselLoading] = useState(true)
    const [strongReferences, setStrongReferences] = useState<StrongReference[]>([])
    const [currentStrongReference, setCurrentStrongReference] = useState<StrongReference>()

    let _carousel = React.useRef<ICarouselInstance>(null)

    useEffect(() => {
        loadPage()
    }, [props.verse.Verset])

    const loadPage = async () => {
        const { verse } = props
        const strongVerse = await loadStrongVerse(verse)

        if (!strongVerse) {
            setError(true)
            return
        }

        const versesInCurrentChapter =
            countLsgChapters[`${verse.Livre}-${verse.Chapitre}`]

        setVersesInCurrentChapter(versesInCurrentChapter)

        formatVerse(strongVerse)
    }

    const formatVerse = async (strongVerse: any) => {
        const {
            verse: { Livre },
        } = props
        
        const { formattedTexte, references } = await verseToStrong(strongVerse)
        
        setFormattedTexte(formattedTexte)
        async () => {
            const strongReferences = await loadStrongReferences(references, Livre)
            setIsCarouselLoading(false)
            setStrongReferences(strongReferences)
            setCurrentStrongReference(strongReferences[0])

            _carousel.current?.scrollTo({ index: 0, animated: false })
        }
    }

    const findRefIndex = (ref: string) =>
        strongReferences.findIndex(r => r.Code === ref)

    const goToCarouselItem = (ref: string) => {
        const strongRef = strongReferences.find(r => r.Code === ref)
        setCurrentStrongReference(strongRef)
    }

    const onSnapToItem = (index: number) => {
        setCurrentStrongReference(strongReferences[index])
    }

    const renderItem = ({ item, index }: { item: StrongReference, index: number }) => {
        return (
            <StrongCard
                // theme={props.theme}
                theme={theme}
                isSelectionMode={props.isSelectionMode}
                navigation={navigation}
                book={props.verse.Livre}
                strongReference={item}
                index={index}
            />
        )
    }

    const { verse: { Verset } } = props

    return (
        <View style={{ paddingBottom: 20, minHeight: hp(75) }}>
            <Box background paddingTop={10}>
                <StyledVerse>
                    <VersetWrapper>
                        <NumberText>{Verset}</NumberText>
                    </VersetWrapper>
                    <CarouselProvider
                        value={{
                            currentStrongReference: currentStrongReference,
                            goToCarouselItem: goToCarouselItem,
                        }}
                    >
                        <VerseText>{formattedTexte}</VerseText>
                    </CarouselProvider>
                </StyledVerse>
                <BibleVerseDetailFooter
                    {...{
                        verseNumber: Verset,
                        goToNextVerse: () => {
                            props.updateVerse(+1)
                            setIsCarouselLoading(true)
                        },
                        goToPrevVerse: () => {
                            props.updateVerse(-1)
                            setIsCarouselLoading(true)
                        },
                        versesInCurrentChapter,
                    }}
                />
            </Box>
            <Box bg="lightGrey">
                <RoundedCorner />
            </Box>
            <Box flex bg="lightGrey">
                {isCarouselLoading && <Loading />}
                {!isCarouselLoading && (
                    <Carousel
                        ref={_carousel}
                        mode="horizontal-stack"
                        scrollAnimationDuration={300}
                        width={itemWidth}
                        panGestureHandlerProps={{
                            activeOffsetX: [-10, 10],
                        }}
                        modeConfig={{
                            opacityInterval: 0.8,
                            scaleInterval: 0,
                            stackInterval: itemWidth,
                            rotateZDeg: 0,
                        }}
                        style={{
                            marginTop: 15,
                            paddingLeft: 20,
                            overflow: 'visible',
                            flex: 1,
                        }}
                        data={strongReferences}
                        renderItem={renderItem}
                        onSnapToItem={onSnapToItem}
                        defaultIndex={strongReferences.findIndex(
                            r => r?.Code === currentStrongReference?.Code
                        )}
                    />
                )}
            </Box>
        </View>
    )
}

export default compose<any, (props: Props) => React.JSX.Element>(
    // withTheme,
    // withTranslation(),
    waitForStrongDB(),
)(BibleVerseDetailCard)
