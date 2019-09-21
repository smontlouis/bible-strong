import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import Sentry from 'sentry-expo'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import loadStrongReference from '~helpers/loadStrongReference'
import waitForStrongWidget from './waitForStrongWidget'

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const StrongOfTheDay = ({ type, color1 = 'rgba(86,204,242,1)', color2 = 'rgba(47,128,237,1)' }) => {
  const [error, setError] = useState(false)
  const [strongReference, setStrongRef] = useState(false)
  useEffect(() => {
    const loadStrong = async () => {
      const random = randomIntFromInterval(1, type === 'grec' ? 5624 : 8853)
      const strongReference = await loadStrongReference(random, type === 'grec' ? 40 : 1)
      if (!strongReference || strongReference.error) {
        console.log(`Failed to load strong ${random} for type ${type}`)
        Sentry.captureMessage('Failed to load strong', {
          extra: {
            random,
            type
          }
        })
        setError(true)
        return
      }

      setStrongRef(strongReference)
    }
    loadStrong()
  }, [type])

  if (error) {
    return (
      <Box center shadow height={100} padding={30}>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>Une erreur est survenue.</Text>
        <Text fontSize={12}>La base de données semble être corrompue.</Text>
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

  const { Grec, Hebreu, Mot } = strongReference

  return (
    <Link route="BibleStrongDetail" params={{ book: 40, strongReference }} style={{ flex: 1 }}>
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
        <Paragraph style={{ color: 'white' }} scale={2} scaleLineHeight={-2}>
          {Grec || Hebreu}
        </Paragraph>
        <Text title fontSize={16} style={{ color: 'white' }}>
          {Mot}
        </Text>
      </Box>
    </Link>
  )
}

export default waitForStrongWidget(StrongOfTheDay)
