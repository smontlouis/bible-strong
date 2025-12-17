import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import loadDictionnaireItemByRowId from '~helpers/loadDictionnaireItemByRowId'
import useLanguage from '~helpers/useLanguage'
import RandomButton from './RandomButton'
import waitForDictionnaireWidget from './waitForDictionnaireWidget'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const DictionnaireOfTheDay = ({ color1 = 'rgba(86,204,242,1)', color2 = 'rgba(47,128,237,1)' }) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const [error, setError] = useState(false)
  const [startRandom, setStartRandom] = useState(true)
  const [strongReference, setStrongRef] = useState(null)
  useEffect(() => {
    const loadStrong = async () => {
      if (!startRandom) return

      // UGLY HACK
      const strongReference = await loadDictionnaireItemByRowId(
        isFR ? randomIntFromInterval(5437, 10872) : randomIntFromInterval(1, 8620)
      )
      if (!strongReference || strongReference.error) {
        setError(strongReference?.error || true)
        return
      }

      setStrongRef(strongReference)
      setStartRandom(false)
    }
    loadStrong()
  }, [startRandom, isFR])

  if (error) {
    return (
      <WidgetContainer>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>{t('Une erreur est survenue.')}</Text>
      </WidgetContainer>
    )
  }

  if (!strongReference) {
    return <WidgetLoading />
  }

  const { word } = strongReference

  return (
    <Link route="DictionnaryDetail" params={{ word }}>
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
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: itemHeight }}
            colors={[color1, color2]}
          />
        </Box>
        <RandomButton onPress={() => setStartRandom(true)} />
        <Box flex={1} center>
          <Paragraph mt={20} scale={-2} color="white" scaleLineHeight={-2}>
            {word}
          </Paragraph>
        </Box>
        <Link route="Dictionnaire" style={{ width: '100%' }}>
          <Box row center backgroundColor="rgba(0,0,0,0.04)" paddingVertical={10}>
            <DictionnaireIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text color="white" bold fontSize={12}>
              {t('Dictionnaire W.')}
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default waitForDictionnaireWidget(DictionnaireOfTheDay)
