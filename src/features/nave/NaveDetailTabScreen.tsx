import React, { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { WebView } from 'react-native-webview'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp } from '@react-navigation/stack'
import DetailedHeader from '~common/DetailedHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import waitForNaveDB from '~common/waitForNaveDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import loadNaveItem from '~helpers/loadNaveItem'
import useHTMLView from '~helpers/useHTMLView'
import { RootState } from '~redux/modules/reducer'
import { historyAtom, multipleTagsModalAtom } from '../../state/app'
import { NaveTab } from '../../state/tabs'
import { MainStackProps } from '~navigation/type'

interface NaveDetailScreenProps {
  navigation: StackNavigationProp<MainStackProps, 'NaveDetail'>
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveDetailScreen = ({ navigation, naveAtom }: NaveDetailScreenProps) => {
  const [naveTab, setNaveTab] = useAtom(naveAtom)

  const {
    hasBackButton,
    data: { name_lower, name },
  } = naveTab

  const dispatch = useDispatch()
  const addHistory = useSetAtom(historyAtom)

  const [naveItem, setNaveItem] = useState(null)
  const { t } = useTranslation()
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const tags = useSelector(
    (state: RootState) => state.user.bible.naves[name_lower]?.tags,
    shallowEqual
  )
  const openInNewTab = useOpenInNewTab()

  const setTitle = (title: string) =>
    setNaveTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(naveItem?.name || name)
  }, [naveItem?.name, name])

  useEffect(() => {
    loadNaveItem(name_lower).then(result => {
      setNaveItem(result)
      addHistory({
        name: result.name,
        name_lower: result.name_lower,
        type: 'nave',
        date: Date.now(),
      })
    })
  }, [name, name_lower])

  const openLink = ({ href }) => {
    const [type, item] = href.split('=')

    if (type === 'v') {
      try {
        const [book, chapter, verses] = item.split('-')
        const [verse] = verses ? verses.split(',') : []
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
          focusVerses: verses?.split(',').map(Number),
          // TODO : add version
        })
      } catch (e) {
        console.log(e)
        Snackbar.show('Impossible de charger ce verset.')
      }
    }

    if (type === 'w') {
      navigation.navigate('NaveDetail', {
          name_lower: item,
          name: item
        })
      // navigation.navigate({
      //   routeName: 'NaveDetail',
      //   params: {
      //     name_lower: item,
      //   },
      //   key: name_lower,
      // })
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink })

  const shareDefinition = () => {
    try {
      const message = `${name} \n\n${truncHTML(naveItem.description, 4000)
        .text.replace(/&#/g, '\\')
        .replace(/\\x([0-9A-F]+);/gi, function() {
          return String.fromCharCode(parseInt(arguments[1], 16))
        })} \n\nLa suite sur https://bible-strong.app`

      Share.share({ message })
    } catch (e) {
      Snackbar.show('Erreur lors du partage.')
      console.log(e)
    }
  }

  return (
    <Container>
      <DetailedHeader
        hasBackButton={hasBackButton}
        title={naveItem?.name || name}
        subtitle={naveItem?.name_lower}
        borderColor="quint"
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() =>
                    setMultipleTagsItem({
                      id: naveItem.name_lower,
                      title: naveItem.name,
                      entity: 'naves',
                    })
                  }
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="tag" size={15} />
                    <Text marginLeft={10}>{t('Étiquettes')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={shareDefinition}>
                  <Box row alignItems="center">
                    <FeatherIcon name="share-2" size={15} />
                    <Text marginLeft={10}>{t('Partager')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `nave-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'nave',
                      data: {
                        name,
                        name_lower,
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
        }
      />
      {tags && (
        <Box mt={10} px={20}>
          <TagList tags={tags} />
        </Box>
      )}
      <Box
        mt={10}
        style={{
          overflow: 'hidden',
          flex: 1,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        }}
      >
        {naveItem?.description && (
          <WebView {...webviewProps(naveItem.description)} />
        )}
      </Box>
    </Container>
  )
}

export default waitForNaveDB()(NaveDetailScreen)
