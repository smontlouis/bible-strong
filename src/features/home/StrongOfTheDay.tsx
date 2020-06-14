import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import * as Sentry from '@sentry/react-native'

import { wp } from '~helpers/utils'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import loadRandomStrongReference from '~helpers/loadRandomStrongReference'
import waitForStrongWidget from './waitForStrongWidget'
import { WidgetContainer, WidgetLoading, itemHeight } from './widget'
import LexiqueIcon from '~common/LexiqueIcon'
import RandomButton from './RandomButton'
import truncate from '~helpers/truncate'

const StrongOfTheDay = ({
  type,
  color1 = 'rgb(69,150,220)',
  color2 = 'rgb(89,131,240)',
}) => {
  const [error, setError] = useState(false)
  const [startRandom, setStartRandom] = useState(true)
  const [strongReference, setStrongRef] = useState(false)
  useEffect(() => {
    const loadStrong = async () => {
      if (!startRandom) return

      const strongReference = await loadRandomStrongReference(
        type === 'grec' ? 40 : 1
      )

      if (!strongReference) {
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
            <Text marginTop={5}>Pas de strong pour ce Code.</Text>
          </>
        ) : (
          <>
            <FeatherIcon name="x" size={30} color="quart" />
            <Text marginTop={5}>Une erreur est survenue.</Text>
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
    <Link
      route="BibleStrongDetail"
      params={{ book: Grec ? 40 : 1, strongReference }}
    >
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
            style={{ height: 130 }}
            colors={[color1, color2]}
          />
        </Box>
        <RandomButton onPress={() => setStartRandom(true)} />
        <Box flex={1} center mt={20}>
          <Box
            backgroundColor="rgba(0,0,0,0.1)"
            paddingHorizontal={5}
            paddingVertical={3}
            rounded
          >
            <Text fontSize={10} style={{ color: 'white' }}>
              {type === 'grec' ? 'Grec' : 'Hébreu'}
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
          <Box
            row
            center
            backgroundColor="rgba(0,0,0,0.04)"
            paddingVertical={10}
          >
            <LexiqueIcon style={{ marginRight: 10 }} size={20} color="white" />
            <Text color="white" bold fontSize={12}>
              Lexique
            </Text>
          </Box>
        </Link>
      </WidgetContainer>
    </Link>
  )
}

export default waitForStrongWidget(StrongOfTheDay)
