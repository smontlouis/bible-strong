import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import loadRandomStrongReference from '~helpers/loadRandomStrongReference'
import truncate from '~helpers/truncate'
import RandomButton from './RandomButton'
import waitForStrongWidget from './waitForStrongWidget'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import { MainStackProps } from '~navigation/type'
import { StackNavigationProp } from '@react-navigation/stack'
import { useNavigation } from '@react-navigation/native'
import { StrongReference } from '~common/types'

const StrongOfTheDay = ({ type, color1 = 'rgb(69,150,220)', color2 = 'rgb(89,131,240)' }: any) => {
  const { t } = useTranslation()

  const [error, setError] = useState<any>(false)
  const [startRandom, setStartRandom] = useState(true)
  const [strongReference, setStrongRef] = useState<StrongReference | undefined>(undefined)

  useEffect(() => {
    const loadStrong = async () => {
      if (!startRandom) return

      const strongReference = await loadRandomStrongReference(type === 'grec' ? 40 : 1)

      if (!strongReference) {
        // @ts-ignore
        setError('NOT_FOUND')
      }

      if (strongReference && strongReference.error) {
        console.log(`Failed to load strong for type ${type}`)

        setError(true)
        return
      }

      setStrongRef(strongReference)
      setStartRandom(false)
    }
    loadStrong()
  }, [type, startRandom])

  if (error) {
    return (
      <WidgetContainer>
        {error === 'NOT_FOUND' ? (
          <>
            <FeatherIcon name="slash" size={30} color="quart" />
            <Text marginTop={5}>{t('Pas de strong pour ce Code.')}</Text>
          </>
        ) : (
          <>
            <FeatherIcon name="x" size={30} color="quart" />
            <Text marginTop={5}>{t('Une erreur est survenue.')}</Text>
          </>
        )}
      </WidgetContainer>
    )
  }

  if (!strongReference) {
    return <WidgetLoading />
  }

  const { Grec, Hebreu, Mot } = strongReference

  return (
    <Link route="Strong" params={{ book: Grec ? 40 : 1, strongReference }}>
      <WidgetContainer>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: itemHeight,
            borderRadius: 3,
          }}
        >
          <LinearGradient start={[0.1, 0.2]} style={{ height: 130 }} colors={[color1, color2]} />
        </Box>
        <RandomButton onPress={() => setStartRandom(true)} />
        <Box flex={1} center mt={20}>
          <Box backgroundColor="rgba(0,0,0,0.1)" paddingHorizontal={5} paddingVertical={3} rounded>
            <Text fontSize={10} style={{ color: 'white' }}>
              {type === 'grec' ? t('Grec') : t('Hébreu')}
            </Text>
          </Box>
          <Paragraph title scale={-2} style={{ color: 'white' }}>
            {truncate(Mot, 10)}
          </Paragraph>
          <Paragraph
            style={{ color: 'white', opacity: 0.5 }}
            scale={-3}
            scaleLineHeight={-2}
            marginBottom={3}
          >
            {truncate(Grec, 10) || truncate(Hebreu, 10)}
          </Paragraph>
        </Box>
        <Link route="Lexique" style={{ width: '100%' }}>
          <Box row center backgroundColor="rgba(0,0,0,0.04)" paddingVertical={10}>
            <LexiqueIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text color="white" bold fontSize={12}>
              {t('Lexique')}
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default waitForStrongWidget(StrongOfTheDay)
