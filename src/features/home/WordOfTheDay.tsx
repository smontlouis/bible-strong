import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import { wp } from '~helpers/utils'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import loadDictionnaireItemByRowId from '~helpers/loadDictionnaireItemByRowId'
import waitForDictionnaireWidget from './waitForDictionnaireWidget'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import DictionnaireIcon from '~common/DictionnaryIcon'
import RandomButton from './RandomButton'

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const DictionnaireOfTheDay = ({
  color1 = 'rgba(86,204,242,1)',
  color2 = 'rgba(47,128,237,1)',
}) => {
  const [error, setError] = useState(false)
  const [startRandom, setStartRandom] = useState(true)
  const [strongReference, setStrongRef] = useState(null)
  useEffect(() => {
    const loadStrong = async () => {
      if (!startRandom) return

      const strongReference = await loadDictionnaireItemByRowId(
        randomIntFromInterval(5437, 10872)
      )
      if (strongReference.error) {
        setError(strongReference.error)
        return
      }

      setStrongRef(strongReference)
      setStartRandom(false)
    }
    loadStrong()
  }, [startRandom])

  if (error) {
    return (
      <WidgetContainer>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>Une erreur est survenue.</Text>
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
          <Box
            backgroundColor="rgba(0,0,0,0.1)"
            paddingHorizontal={5}
            paddingVertical={3}
            rounded
          >
            <Text fontSize={10} color="white">
              Dictionnaire
            </Text>
          </Box>
          <Paragraph scale={-1} color="white" scaleLineHeight={-2}>
            {word}
          </Paragraph>
        </Box>
        <Link route="Dictionnaire" style={{ width: '100%' }}>
          <Box
            row
            center
            backgroundColor="rgba(0,0,0,0.04)"
            paddingVertical={10}
          >
            <DictionnaireIcon
              style={{ marginRight: 10 }}
              size={20}
              color="white"
            />
            <Text color="white" bold fontSize={12}>
              Dictionnaire
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default waitForDictionnaireWidget(DictionnaireOfTheDay)
