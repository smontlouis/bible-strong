import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  EntryAnimationsValues,
  EntryExitAnimationFunction,
  ExitAnimationsValues,
  SharedValue,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useSharedValue,
} from 'react-native-reanimated'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import { BibleResource, Verse } from '~common/types'
import Box, { AnimatedBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import CommentariesCard from '~features/commentaries/CommentariesCard'
import DictionnaireVerseDetailCard from '~features/dictionnary/DictionnaireVerseDetailCard'
import NaveModalCard from '~features/nave/NaveModalCard'
import formatVerseContent from '~helpers/formatVerseContent'
import { useModalize } from '~helpers/useModalize'
import { BibleTab, useBibleTabActions } from '../../../state/tabs'
import BibleVerseDetailCard from '../BibleVerseDetailCard'
import { ReferenceCard } from '../ReferenceCard'
import ResourcesModalFooter from './ResourcesModalFooter'

type Props = {
  resourceType: BibleResource | null
  onChangeResourceType: (resourceType: BibleResource | null) => void
  bibleAtom: PrimitiveAtom<BibleTab>
}
const ResourcesModal = ({
  resourceType,
  onChangeResourceType,
  bibleAtom,
}: Props) => {
  const { t } = useTranslation()
  const { ref, open, close } = useModalize()
  const openInNewTab = useOpenInNewTab()
  const bible = useAtomValue(bibleAtom)
  const direction = useSharedValue<'left' | 'right'>('left')

  const {
    data: { selectedVerses },
  } = bible
  const selectedVerse = Object.keys(selectedVerses)[0]

  useEffect(() => {
    if (resourceType) {
      open()
    }
  }, [resourceType, open])

  const { title } = formatVerseContent([selectedVerse])

  const getSubtitleByResourceType = () => {
    switch (resourceType) {
      case 'strong':
        return t('Lexique hébreu & grec')
      case 'commentary':
        return t('Commentaires')
      case 'dictionary':
        return t('Dictionnaire')
      case 'nave':
        return t('Par thèmes')
      case 'reference':
        return t('Références croisées')
      default:
        return ''
    }
  }

  const getOptionsByResourceType = () => {
    switch (resourceType) {
      case 'commentary': {
        return (
          <PopOverMenu
            width={24}
            height={54}
            popover={
              <>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `commentary-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'commentary',
                      data: {
                        verse: selectedVerse,
                      },
                    })
                  }}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        )
      }
      default:
        return undefined
    }
  }

  return (
    <Modal.Body
      ref={ref}
      HeaderComponent={
        <ModalHeader
          title={title}
          subTitle={getSubtitleByResourceType()}
          rightComponent={getOptionsByResourceType()}
          onClose={close}
        />
      }
      FooterComponent={
        <ResourcesModalFooter
          resourceType={resourceType}
          onChangeResourceType={onChangeResourceType}
          direction={direction}
        />
      }
      onClosed={() => onChangeResourceType(null)}
      modalRef={ref}
    >
      <Resource
        resourceType={resourceType}
        bibleAtom={bibleAtom}
        direction={direction}
      />
    </Modal.Body>
  )
}

const slideOutLeftAnimation = new SlideOutLeft().build() as EntryExitAnimationFunction
const slideOutRightAnimation = new SlideOutRight().build() as EntryExitAnimationFunction

const slideInLeftAnimation = new SlideInLeft().build() as EntryExitAnimationFunction
const slideInRightAnimation = new SlideInRight().build() as EntryExitAnimationFunction

const AnimatedResourceBox = ({
  direction,
  isAnimationsEnabled,
  ...props
}: {
  direction: SharedValue<'left' | 'right'>
  isAnimationsEnabled: React.MutableRefObject<boolean>
}) => {
  const SlideIn = (values: EntryAnimationsValues) => {
    'worklet'

    return direction.value === 'left'
      ? slideInRightAnimation(values)
      : slideInLeftAnimation(values)
  }

  const SlideOut = (values: ExitAnimationsValues) => {
    'worklet'

    return direction.value === 'left'
      ? slideOutLeftAnimation(values)
      : slideOutRightAnimation(values)
  }

  //This is to check if the layouting took place and return the according animation
  const ifEnabled = (animation: any): any => {
    return isAnimationsEnabled.current ? animation : undefined
  }

  return (
    <AnimatedBox
      entering={ifEnabled(SlideIn)}
      exiting={ifEnabled(SlideOut)}
      {...props}
    />
  )
}

const Resource = ({
  bibleAtom,
  resourceType,
  direction,
}: {
  bibleAtom: PrimitiveAtom<BibleTab>
  resourceType: BibleResource | null
  direction: Animated.SharedValue<'left' | 'right'>
}) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const {
    data: { selectedVersion, selectedVerses },
  } = bible
  const selectedVerse = Object.keys(selectedVerses)[0]
  const [Livre, Chapitre, Verset] = selectedVerse
    ? selectedVerse?.split('-')
    : []

  const verseObj = {
    Livre,
    Chapitre,
    Verset,
    Texte: '',
  } as Verse

  const updateVerse = (incr: number) => {
    actions.selectSelectedVerse(`${Livre}-${Chapitre}-${Number(Verset) + incr}`)
  }

  const isAnimationsEnabled = useRef(false)

  //This is enabling the animations after layouting
  useLayoutEffect(() => {
    if (resourceType) isAnimationsEnabled.current = true
  }, [resourceType])

  if (resourceType === 'strong') {
    return (
      <AnimatedResourceBox
        key={resourceType}
        direction={direction}
        isAnimationsEnabled={isAnimationsEnabled}
      >
        {/* @ts-ignore */}
        <BibleVerseDetailCard verse={verseObj} updateVerse={updateVerse} />
      </AnimatedResourceBox>
    )
  }
  if (resourceType === 'dictionary') {
    return (
      <AnimatedResourceBox
        key={resourceType}
        direction={direction}
        isAnimationsEnabled={isAnimationsEnabled}
      >
        <DictionnaireVerseDetailCard
          verse={verseObj}
          updateVerse={updateVerse}
        />
      </AnimatedResourceBox>
    )
  }
  if (resourceType === 'nave') {
    return (
      <AnimatedResourceBox
        key={resourceType}
        direction={direction}
        isAnimationsEnabled={isAnimationsEnabled}
      >
        <NaveModalCard selectedVerse={selectedVerse} />
      </AnimatedResourceBox>
    )
  }
  if (resourceType === 'reference') {
    return (
      <AnimatedResourceBox
        key={resourceType}
        direction={direction}
        isAnimationsEnabled={isAnimationsEnabled}
      >
        <ReferenceCard
          selectedVerse={selectedVerse}
          version={selectedVersion}
        />
      </AnimatedResourceBox>
    )
  }
  if (resourceType === 'commentary') {
    return (
      <AnimatedResourceBox
        key={resourceType}
        direction={direction}
        isAnimationsEnabled={isAnimationsEnabled}
      >
        <CommentariesCard
          verse={selectedVerse}
          onChangeVerse={actions.selectSelectedVerse}
        />
      </AnimatedResourceBox>
    )
  }
  return null
}

export default ResourcesModal
