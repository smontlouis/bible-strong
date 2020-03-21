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

const itemWidth = wp(60) > 300 ? 300 : wp(60)
const itemHeight = 130

const StrongOfTheDay = ({
  type,
  color1 = 'rgb(69,150,220)',
  color2 = 'rgb(89,131,240)'
}) => {
  const [error, setError] = useState(false)
  const [strongReference, setStrongRef] = useState(false)
  useEffect(() => {
    const loadStrong = async () => {
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
    }
    loadStrong()
  }, [type])

  if (error) {
    return (
      <Box
        center
        rounded
        height={itemHeight}
        padding={30}
        width={itemWidth}
        marginRight={20}
      >
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
      </Box>
    )
  }

  if (!strongReference) {
    return (
      <Box
        height={itemHeight}
        center
        rounded
        width={itemWidth}
        marginRight={20}
      >
        <Text>Chargement...</Text>
      </Box>
    )
  }

  const { Grec, Hebreu, Mot } = strongReference

  return (
    <Link
      route="BibleStrongDetail"
      params={{ book: Grec ? 40 : 1, strongReference }}
      style={{ width: itemWidth }}
    >
      <Box center rounded marginRight={20} height={itemHeight}>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: itemHeight,
            borderRadius: 3
          }}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: 130 }}
            colors={[color1, color2]}
          />
        </Box>
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
        <Paragraph
          style={{ color: 'white' }}
          scale={1}
          scaleLineHeight={-2}
          marginBottom={3}
        >
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
