import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import loadDictionnaireItemByRowId from '~helpers/loadDictionnaireItemByRowId'
import waitForDictionnaireWidget from './waitForDictionnaireWidget'

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const DictionnaireOfTheDay = ({ color1 = 'rgba(86,204,242,1)', color2 = 'rgba(47,128,237,1)' }) => {
  const [error, setError] = useState(false)
  const [strongReference, setStrongRef] = useState(null)
  useEffect(() => {
    const loadStrong = async () => {
      const strongReference = await loadDictionnaireItemByRowId(randomIntFromInterval(5437, 10872))
      if (strongReference.error) {
        setError(strongReference.error)
        return
      }

      setStrongRef(strongReference)
    }
    loadStrong()
  }, [])

  if (error) {
    return (
      <Box center shadow height={100} padding={30}>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>Une erreur est survenue.</Text>
      </Box>
    )
  }

  if (!strongReference) {
    return (
      <Box height={100} center>
        <Text>Chargement...</Text>
      </Box>
    )
  }

  const { word } = strongReference

  return (
    <Link route="DictionnaryDetail" params={{ word }}>
      <Box center shadow height={100}>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 100,
            borderRadius: 3
          }}>
          <LinearGradient start={[0.1, 0.2]} style={{ height: 100 }} colors={[color1, color2]} />
        </Box>
        <Paragraph style={{ color: 'white' }} scale={3} scaleLineHeight={-2}>
          {word}
        </Paragraph>
      </Box>
    </Link>
  )
}

export default waitForDictionnaireWidget(DictionnaireOfTheDay)
